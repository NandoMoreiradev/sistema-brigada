// backend/src/communications/communication-broadcast.service.ts
//
// "Comunicado" = e-mail avulso que um admin/cargo delegado (communications:manage) escreve e
// manda pra um público-alvo da própria academia — diferente de EmailTemplate (templates dos 3
// gatilhos automáticos, ver email-templates/). Reaproveita a mesma infra de
// renderização/envio (EmailRendererService/MailService/MergeTagService) já usada por
// EmailTemplatesService.sendTestEmail.
//
// Sem fila/dependência nova pro envio em massa: `send()` resolve os destinatários, cria as
// linhas de CommunicationRecipient e dispara `processSend` em background (fire-and-forget,
// mesmo padrão de OrganizationsService.create() pro e-mail de boas-vindas) — a request HTTP
// não fica presa esperando N e-mails saírem.

import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CommunicationAudience, CommunicationRecipientStatus, CommunicationStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EmailRendererService } from './email-renderer.service';
import { MailService } from './mail.service';
import { MergeTagService, MergeTagContext } from '../common/merge-tag.service';
import { CreateCommunicationDto } from './dto/create-communication.dto';
import { UpdateCommunicationDto } from './dto/update-communication.dto';
import { ListCommunicationsDto } from './dto/list-communications.dto';

const LIMITS = { MAX_BODY_LENGTH: 100000 };

/** Pequeno intervalo entre envios sequenciais — evita estourar rate limit do Resend sem
 * precisar de fila/dependência nova (organizações deste produto são de porte modesto). */
const SEND_DELAY_MS = 300;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const CREATED_BY_SELECT = { select: { id: true, name: true } } as const;

@Injectable()
export class CommunicationBroadcastService {
    private readonly logger = new Logger(CommunicationBroadcastService.name);
    private readonly backendPublicUrl: string;

    constructor(
        private readonly prisma: PrismaService,
        private readonly emailRenderer: EmailRendererService,
        private readonly mailService: MailService,
        private readonly mergeTagService: MergeTagService,
        private readonly configService: ConfigService,
    ) {
        this.backendPublicUrl = (this.configService.get<string>('BACKEND_PUBLIC_URL') ?? 'http://localhost:3000').replace(/\/$/, '');
    }

    async create(_dto: CreateCommunicationDto, organizationId: string, userId: string) {
        return this.prisma.communication.create({
            data: {
                organizationId,
                createdByUserId: userId,
                subject: '',
                body: '<p>Escreva o conteúdo do comunicado.</p>',
                audience: CommunicationAudience.ALL,
            },
            include: { createdBy: CREATED_BY_SELECT },
        });
    }

    async findAll(organizationId: string, query: ListCommunicationsDto) {
        const { page = 1, limit = 20, search } = query;
        const where: Prisma.CommunicationWhereInput = { organizationId };
        if (search?.trim()) where.subject = { contains: search.trim(), mode: 'insensitive' };

        const [data, total] = await this.prisma.$transaction([
            this.prisma.communication.findMany({
                where,
                include: { createdBy: CREATED_BY_SELECT },
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
            }),
            this.prisma.communication.count({ where }),
        ]);

        return { data, total, page, totalPages: Math.ceil(total / limit) };
    }

    async findOne(id: string, organizationId: string) {
        const communication = await this.prisma.communication.findFirst({
            where: { id, organizationId },
            include: {
                createdBy: CREATED_BY_SELECT,
                recipients: { orderBy: { name: 'asc' } },
            },
        });
        if (!communication) {
            throw new NotFoundException(`Comunicado com ID "${id}" não encontrado.`);
        }
        return communication;
    }

    async update(id: string, organizationId: string, dto: UpdateCommunicationDto) {
        const existing = await this.findOne(id, organizationId);
        if (existing.status !== CommunicationStatus.DRAFT) {
            throw new ConflictException('Este comunicado já foi enviado e não pode mais ser editado.');
        }

        if (dto.body && dto.body.length > LIMITS.MAX_BODY_LENGTH) {
            throw new BadRequestException(`O corpo do e-mail excede o limite de ${LIMITS.MAX_BODY_LENGTH} caracteres.`);
        }

        const { designJson, body, ...rest } = dto;
        const dataToUpdate: Prisma.CommunicationUpdateInput = { ...rest };

        if (this.isPlainObject(designJson)) {
            try {
                dataToUpdate.body = await this.emailRenderer.renderDesignJson(designJson, {});
                dataToUpdate.designJson = designJson as Prisma.JsonObject;
            } catch (error) {
                this.logger.error(`Falha ao renderizar designJson do comunicado ${id}`, (error as Error).stack);
                throw new BadRequestException('Falha ao processar o design do e-mail.');
            }
        } else if (body) {
            dataToUpdate.body = body;
        }

        return this.prisma.communication.update({
            where: { id: existing.id },
            data: dataToUpdate,
            include: { createdBy: CREATED_BY_SELECT },
        });
    }

    async remove(id: string, organizationId: string) {
        const existing = await this.findOne(id, organizationId);
        if (existing.status !== CommunicationStatus.DRAFT) {
            throw new ConflictException('Só é possível excluir um comunicado que ainda não foi enviado.');
        }
        await this.prisma.communication.delete({ where: { id } });
        return { message: 'Comunicado removido.' };
    }

    /** Só {id,name,email} — é tudo que o envio e o log de destinatários precisam. */
    async resolveRecipients(organizationId: string, audience: CommunicationAudience, customRecipientUserIds: string[]) {
        const where: Prisma.UserWhereInput = { organizationId, isActive: true };

        if (audience === CommunicationAudience.STUDENTS) {
            where.studentProfile = { isNot: null };
        } else if (audience === CommunicationAudience.STAFF) {
            where.staffMember = { status: 'ACTIVE' };
        } else if (audience === CommunicationAudience.CUSTOM) {
            where.id = { in: customRecipientUserIds };
        }

        return this.prisma.user.findMany({ where, select: { id: true, name: true, email: true } });
    }

    async send(id: string, organizationId: string) {
        const communication = await this.findOne(id, organizationId);
        if (communication.status !== CommunicationStatus.DRAFT) {
            throw new ConflictException('Este comunicado já foi enviado.');
        }
        if (!communication.subject.trim()) {
            throw new BadRequestException('Informe o assunto do e-mail antes de enviar.');
        }

        const recipients = await this.resolveRecipients(organizationId, communication.audience, communication.customRecipientUserIds);
        if (recipients.length === 0) {
            throw new BadRequestException('Nenhum destinatário encontrado para o público-alvo selecionado.');
        }

        await this.prisma.$transaction([
            this.prisma.communicationRecipient.createMany({
                data: recipients.map((r) => ({ communicationId: id, userId: r.id, name: r.name, email: r.email })),
            }),
            this.prisma.communication.update({
                where: { id },
                data: { status: CommunicationStatus.SENDING, recipientCount: recipients.length },
            }),
        ]);

        void this.processSend(id);

        return { message: 'Envio iniciado.', recipientCount: recipients.length };
    }

    /** Nunca lança — roda em background, fora do ciclo da request que disparou `send()`. */
    private async processSend(id: string): Promise<void> {
        try {
            const communication = await this.prisma.communication.findUniqueOrThrow({
                where: { id },
                include: { organization: { select: { name: true, logoUrl: true } } },
            });
            const pendingRecipients = await this.prisma.communicationRecipient.findMany({
                where: { communicationId: id, status: CommunicationRecipientStatus.PENDING },
            });

            let failedCount = 0;

            for (const recipient of pendingRecipients) {
                const context: MergeTagContext = {
                    organization: communication.organization,
                    organization_name: communication.organization.name,
                    user: { name: recipient.name, email: recipient.email },
                    user_name: recipient.name,
                };

                try {
                    const bodyHtml = communication.designJson
                        ? await this.emailRenderer.renderDesignJson(communication.designJson, context)
                        : this.mergeTagService.process(communication.body, context);

                    const html = await this.emailRenderer.renderWithOrganizationLayout(bodyHtml, communication.organization, context, {
                        senderIdentity: 'organization',
                    });
                    const htmlWithTrackingPixel = this.appendTrackingPixel(html, recipient.id);
                    const subject = this.mergeTagService.process(communication.subject, context);

                    await this.mailService.sendSingleOrThrow({
                        organizationId: communication.organizationId,
                        to: recipient.email,
                        subject,
                        html: htmlWithTrackingPixel,
                    });

                    await this.prisma.communicationRecipient.update({
                        where: { id: recipient.id },
                        data: { status: CommunicationRecipientStatus.SENT, sentAt: new Date() },
                    });
                } catch (error) {
                    failedCount++;
                    this.logger.error(`Falha ao enviar comunicado ${id} para ${recipient.email}: ${(error as Error).message}`);
                    await this.prisma.communicationRecipient.update({
                        where: { id: recipient.id },
                        data: { status: CommunicationRecipientStatus.FAILED, errorMessage: (error as Error).message?.slice(0, 500) },
                    });
                }

                await sleep(SEND_DELAY_MS);
            }

            const total = pendingRecipients.length;
            await this.prisma.communication.update({
                where: { id },
                data: {
                    status: failedCount === total ? CommunicationStatus.FAILED : CommunicationStatus.SENT,
                    failedCount,
                    sentAt: new Date(),
                },
            });
        } catch (error) {
            this.logger.error(`Falha ao processar envio do comunicado ${id}`, (error as Error).stack);
            await this.prisma.communication
                .update({ where: { id }, data: { status: CommunicationStatus.FAILED } })
                .catch(() => undefined);
        }
    }

    private appendTrackingPixel(html: string, recipientId: string): string {
        const pixelUrl = `${this.backendPublicUrl}/api/v1/public/communications/recipients/${recipientId}/open.gif`;
        const pixel = `<img src="${pixelUrl}" width="1" height="1" alt="" style="display:none" />`;
        return html.includes('</body>') ? html.replace('</body>', `${pixel}</body>`) : `${html}${pixel}`;
    }

    async sendTest(id: string, organizationId: string, to: string) {
        const communication = await this.findOne(id, organizationId);

        const testContext: MergeTagContext = {
            organization: { name: 'Academia Exemplo' },
            organization_name: 'Academia Exemplo',
            user: { name: 'João da Silva', email: 'joao@exemplo.com' },
            user_name: 'João da Silva',
        };

        const processedSubject = this.mergeTagService.process(communication.subject, testContext);
        const bodyHtml = communication.designJson
            ? await this.emailRenderer.renderDesignJson(communication.designJson, testContext)
            : this.mergeTagService.process(communication.body, testContext);
        const finalHtml = await this.emailRenderer.renderWithOrganizationLayout(bodyHtml, testContext.organization, testContext, {
            senderIdentity: 'organization',
        });

        try {
            await this.mailService.sendSingleOrThrow({
                organizationId,
                to,
                subject: `[TESTE] ${processedSubject}`,
                html: finalHtml,
            });
        } catch (error) {
            throw new BadRequestException(`Não foi possível enviar o e-mail de teste: ${(error as Error).message}`);
        }

        return { message: `E-mail de teste enviado para ${to} com sucesso.` };
    }

    /** Chamado pelo endpoint público do pixel de rastreio — nunca lança (id inválido/já
     * removido é só ignorado silenciosamente, o cliente de e-mail sempre recebe o gif). */
    async trackOpen(recipientId: string): Promise<void> {
        try {
            const recipient = await this.prisma.communicationRecipient.findUnique({ where: { id: recipientId } });
            if (!recipient) return;

            const isFirstOpen = !recipient.openedAt;
            await this.prisma.communicationRecipient.update({
                where: { id: recipientId },
                data: { openedAt: recipient.openedAt ?? new Date(), openCount: { increment: 1 } },
            });

            if (isFirstOpen) {
                await this.prisma.communication.update({
                    where: { id: recipient.communicationId },
                    data: { openedCount: { increment: 1 } },
                });
            }
        } catch (error) {
            this.logger.warn(`Falha ao registrar abertura do comunicado (recipient: ${recipientId}): ${(error as Error).message}`);
        }
    }

    private isPlainObject(value: unknown): value is Record<string, unknown> {
        return typeof value === 'object' && value !== null && !Array.isArray(value);
    }
}
