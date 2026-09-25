// backend/src/email-templates/email-templates.service.ts
//
// Adaptado de maskotCrmEdu/backend/src/email-templates/email-templates.service.ts
// (schoolId -> organizationId), trimado para os 3 gatilhos deste produto (sem lead/visita/
// onboarding/assinatura — ver EmailTriggerType em schema.prisma) e sem o catálogo de
// merge tags filtrado por "superAdminOnly" (nenhuma das 3 é exclusiva de plataforma aqui).

import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailRendererService } from '../communications/email-renderer.service';
import { MailService } from '../communications/mail.service';
import { MergeTagService, MergeTagContext } from '../common/merge-tag.service';
import { MERGE_TAGS } from '../common/constants/merge-tags.constant';
import { CreateEmailTemplateDto } from './dto/create-email-template.dto';
import { UpdateEmailTemplateDto } from './dto/update-email-template.dto';
import { FindEmailTemplatesQueryDto } from './dto/find-email-templates-query.dto';
import { EmailTriggerType, Prisma, Role } from '@prisma/client';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';

const LIMITS = { MAX_BODY_LENGTH: 100000 };

const TRIGGER_LABELS: Record<EmailTriggerType, string> = {
    ORGANIZATION_ADMIN_WELCOME: 'Boas-vindas ao administrador da academia',
    PASSWORD_RESET: 'Redefinição de senha',
    CERTIFICATE_EXPIRING: 'Certificado vencendo',
    USER_WELCOME: 'Boas-vindas de novo usuário',
    REGISTRATION_APPROVED: 'Cadastro aprovado (autocadastro público)',
};

@Injectable()
export class EmailTemplatesService {
    private readonly logger = new Logger(EmailTemplatesService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly emailRenderer: EmailRendererService,
        private readonly mailService: MailService,
        private readonly mergeTagService: MergeTagService,
    ) {}

    async create(dto: CreateEmailTemplateDto, user: AuthenticatedUser, activeOrganizationId?: string) {
        const { name, subject, trigger, designJson, body } = dto;

        if (body && body.length > LIMITS.MAX_BODY_LENGTH) {
            throw new BadRequestException(`O corpo do e-mail excede o limite de ${LIMITS.MAX_BODY_LENGTH} caracteres.`);
        }

        const organizationIdForTemplate = user.role === Role.SUPER_ADMIN ? (dto.organizationId ?? null) : this.requireActiveOrganization(activeOrganizationId);

        const data: Prisma.EmailTemplateCreateInput = {
            name,
            subject,
            ...(trigger ? { trigger } : {}),
            body: body || '<p>Edite este template.</p>',
            ...(organizationIdForTemplate ? { organization: { connect: { id: organizationIdForTemplate } } } : {}),
            createdBy: { connect: { id: user.id } },
        };

        if (this.isPlainObject(designJson)) {
            try {
                data.body = await this.emailRenderer.renderDesignJson(designJson, {});
                data.designJson = designJson as Prisma.JsonObject;
            } catch (error) {
                this.logger.error(`Falha ao renderizar designJson para o template: ${name}`, (error as Error).stack);
                throw new BadRequestException('Falha ao processar o design do e-mail.');
            }
        }

        try {
            return await this.prisma.emailTemplate.create({ data });
        } catch (error: any) {
            if (error?.code === 'P2002') {
                throw new ConflictException(`Já existe um template com o gatilho "${trigger}" para esta academia. Escolha um gatilho diferente.`);
            }
            throw error;
        }
    }

    async update(id: string, dto: UpdateEmailTemplateDto, user: AuthenticatedUser, activeOrganizationId?: string) {
        const existing = await this.findOne(id, user, activeOrganizationId);

        if (user.role !== Role.SUPER_ADMIN && !existing.organizationId) {
            throw new ForbiddenException('Você não tem permissão para editar templates globais.');
        }

        const { designJson, body, organizationId, ...rest } = dto;

        if (body && body.length > LIMITS.MAX_BODY_LENGTH) {
            throw new BadRequestException(`O corpo do e-mail excede o limite de ${LIMITS.MAX_BODY_LENGTH} caracteres.`);
        }

        const dataToUpdate: Prisma.EmailTemplateUpdateInput = { ...rest };

        if (this.isPlainObject(designJson)) {
            try {
                dataToUpdate.body = await this.emailRenderer.renderDesignJson(designJson, {});
                dataToUpdate.designJson = designJson as Prisma.JsonObject;
            } catch (error) {
                this.logger.error(`Falha ao renderizar designJson para o template ${id}`, (error as Error).stack);
                throw new BadRequestException('Falha ao processar o design do e-mail.');
            }
        } else if (body) {
            dataToUpdate.body = body;
        }

        try {
            return await this.prisma.emailTemplate.update({ where: { id: existing.id }, data: dataToUpdate });
        } catch (error: any) {
            if (error?.code === 'P2002') {
                throw new ConflictException('Já existe um template com esse gatilho para esta academia. Escolha um gatilho diferente.');
            }
            throw error;
        }
    }

    async findOne(id: string, user: AuthenticatedUser, activeOrganizationId?: string) {
        const template = await this.prisma.emailTemplate.findUnique({ where: { id } });
        if (!template) {
            throw new NotFoundException(`Template com ID "${id}" não encontrado.`);
        }

        if (user.role === Role.SUPER_ADMIN || !template.organizationId || template.organizationId === activeOrganizationId) {
            return template;
        }

        throw new ForbiddenException('Você não tem permissão para acessar este template.');
    }

    async remove(id: string, user: AuthenticatedUser, activeOrganizationId?: string) {
        const template = await this.findOne(id, user, activeOrganizationId);
        if (user.role !== Role.SUPER_ADMIN && !template.organizationId) {
            throw new ForbiddenException('Você não tem permissão para remover templates globais.');
        }
        await this.prisma.emailTemplate.delete({ where: { id } });
        return { message: 'Template removido.' };
    }

    async findAll(user: AuthenticatedUser, query: FindEmailTemplatesQueryDto, activeOrganizationId?: string) {
        if (user.role === Role.SUPER_ADMIN && !activeOrganizationId) {
            return this.findAllForPlatform(query);
        }
        return this.findAllForOrganization(activeOrganizationId, query);
    }

    private async findAllForPlatform(query: FindEmailTemplatesQueryDto) {
        const { page = 1, limit = 20, search, trigger, scope } = query;
        const skip = (page - 1) * limit;

        const where: Prisma.EmailTemplateWhereInput = {};
        if (search?.trim()) where.name = { contains: search.trim(), mode: 'insensitive' };
        if (trigger) where.trigger = trigger as EmailTriggerType;
        if (scope === 'global') where.organizationId = null;
        if (scope === 'organization') where.organizationId = { not: null };

        const [data, total] = await this.prisma.$transaction([
            this.prisma.emailTemplate.findMany({
                where,
                orderBy: [{ organizationId: 'asc' }, { name: 'asc' }],
                include: { organization: { select: { id: true, name: true } }, createdBy: { select: { id: true, name: true } } },
                skip,
                take: limit,
            }),
            this.prisma.emailTemplate.count({ where }),
        ]);

        return { data, total, page, totalPages: Math.ceil(total / limit) };
    }

    /** Padrão global como base, override da academia sobrepõe por gatilho. */
    private async findAllForOrganization(organizationId: string | undefined, query: FindEmailTemplatesQueryDto) {
        const { page = 1, limit = 20, search, trigger } = query;

        const organizationTemplates = organizationId
            ? await this.prisma.emailTemplate.findMany({ where: { organizationId }, include: { createdBy: { select: { id: true, name: true } } } })
            : [];

        const globalTemplates = await this.prisma.emailTemplate.findMany({ where: { organizationId: null } });

        const byTrigger = new Map<EmailTriggerType, any>();
        globalTemplates.forEach((t) => t.trigger && byTrigger.set(t.trigger, t));
        organizationTemplates.filter((t) => t.trigger).forEach((t) => byTrigger.set(t.trigger!, t));

        let merged = Array.from(byTrigger.values()).sort((a, b) => a.name.localeCompare(b.name));

        if (search?.trim()) {
            const term = search.trim().toLowerCase();
            merged = merged.filter((t) => t.name.toLowerCase().includes(term));
        }
        if (trigger) merged = merged.filter((t) => t.trigger === trigger);

        const total = merged.length;
        const skip = (page - 1) * limit;
        return { data: merged.slice(skip, skip + limit), total, page, totalPages: Math.ceil(total / limit) };
    }

    getAvailableTriggers() {
        return Object.entries(TRIGGER_LABELS).map(([value, label]) => ({ value, label }));
    }

    getAvailableMergeTags() {
        return MERGE_TAGS;
    }

    async findTemplateByTrigger(organizationId: string | null, trigger: EmailTriggerType) {
        if (organizationId) {
            const organizationTemplate = await this.prisma.emailTemplate.findFirst({ where: { trigger, organizationId } });
            if (organizationTemplate) return organizationTemplate;
        }
        return this.prisma.emailTemplate.findFirst({ where: { trigger, organizationId: null } });
    }

    async sendTestEmail(id: string, to: string, user: AuthenticatedUser, activeOrganizationId?: string) {
        const template = await this.findOne(id, user, activeOrganizationId);
        const organizationId = template.organizationId ?? activeOrganizationId ?? null;

        const testContext = this.buildTestContext();
        const processedSubject = this.mergeTagService.process(template.subject, testContext);

        let bodyHtml: string;
        if (template.designJson) {
            bodyHtml = await this.emailRenderer.renderDesignJson(template.designJson, testContext);
        } else {
            bodyHtml = this.mergeTagService.process(template.body, testContext);
        }

        const finalHtml = await this.emailRenderer.renderWithOrganizationLayout(bodyHtml, testContext.organization, testContext, {
            senderIdentity: organizationId ? 'organization' : 'platform',
        });

        this.logger.log(`Enviando e-mail de teste (template: ${template.name}) para um endereço de teste.`);

        // sendSingleOrThrow (não sendSingle): um teste que "engole" o erro e sempre
        // reporta sucesso não testa nada — é exatamente o problema que este endpoint
        // existe pra resolver.
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

    private buildTestContext(): MergeTagContext {
        return {
            organization: { name: 'Academia Exemplo' },
            organization_name: 'Academia Exemplo',
            user: { name: 'João da Silva', email: 'joao@exemplo.com' },
            user_name: 'João da Silva',
            student: { name: 'Maria Souza' },
            course: { name: 'Brigada de Incêndio — Turma 2026' },
            certificate: { expiresAt: '15/03/2026', link: 'https://exemplo.com/certificates' },
            login_link: 'https://exemplo.com/reset-password?token=teste',
            password_reset_link: 'https://exemplo.com/reset-password?token=teste',
        };
    }

    private requireActiveOrganization(activeOrganizationId?: string): string {
        if (!activeOrganizationId) {
            throw new ForbiddenException('A academia ativa não foi identificada.');
        }
        return activeOrganizationId;
    }

    private isPlainObject(value: unknown): value is Record<string, unknown> {
        return typeof value === 'object' && value !== null && !Array.isArray(value);
    }
}
