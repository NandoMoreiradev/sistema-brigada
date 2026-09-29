// backend/src/registrations/registrations.service.ts
//
// Autocadastro público: alguém sem login preenche o formulário (submitPublic, resolvido
// pelo token da academia — sem subdomínio/tenant por host neste produto, ver
// docs/decisoes.md), a solicitação fica PENDING até um staff com registrations:manage
// aprovar (cria a conta de verdade via UsersService.createAccount, reaproveitando o mesmo
// miolo do cadastro manual pela tela de Alunos) ou recusar (só muda o status).

import { Injectable, NotFoundException, BadRequestException, ConflictException, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, RegistrationKind, RegistrationRequestStatus } from '@prisma/client';
import { UsersService } from '../users/users.service';
import { NotificationsService } from '../notifications/notifications.service';
import { TransactionalEmailService } from '../transactional-email/transactional-email.service';
import { SubmitRegistrationDto } from './dto/submit-registration.dto';
import { ApproveRegistrationDto } from './dto/approve-registration.dto';
import { RejectRegistrationDto } from './dto/reject-registration.dto';
import { ListRegistrationsQueryDto } from './dto/list-registrations-query.dto';
import { CreateInviteDto } from './dto/create-invite.dto';
import { SubmitInviteRegistrationDto } from './dto/submit-invite-registration.dto';
import { PublicRegistrationField, registrationFieldsFor } from '../common/constants/public-registration-fields.constant';

const organizationFieldsSelect = {
    publicRegistrationFields: true,
    publicRegistrationFieldsInstructor: true,
    publicRegistrationFieldsStaff: true,
} as const;

/** Convite dirigido vale 7 dias (renovável por "Reenviar"). */
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const KIND_LABEL: Record<RegistrationKind, string> = {
    STUDENT: 'aluno(a)',
    INSTRUCTOR: 'instrutor(a)',
    STAFF: 'integrante da equipe',
};

const inviteSelect = {
    id: true,
    email: true,
    name: true,
    kind: true,
    expiresAt: true,
    usedAt: true,
    revokedAt: true,
    emailStatus: true,
    emailSentAt: true,
    createdAt: true,
    createdBy: { select: { id: true, name: true } },
} satisfies Prisma.RegistrationInviteSelect;

type InviteRow = Prisma.RegistrationInviteGetPayload<{ select: typeof inviteSelect }>;

const withInviteStatus = (invite: InviteRow) => ({
    ...invite,
    status: invite.usedAt ? 'USED' : invite.revokedAt ? 'REVOKED' : invite.expiresAt.getTime() < Date.now() ? 'EXPIRED' : 'PENDING',
});

const registrationListSelect = {
    id: true,
    name: true,
    email: true,
    phone: true,
    birthDate: true,
    baptismDate: true,
    pioneerStatus: true,
    signedPetitions: true,
    profession: true,
    status: true,
    reviewedAt: true,
    rejectionReason: true,
    createdAt: true,
    requestedKind: true,
    approvedKind: true,
    accessEmailStatus: true,
    accessEmailAt: true,
    inviteId: true,
    createdUserId: true,
    reviewedBy: { select: { id: true, name: true } },
} satisfies Prisma.RegistrationRequestSelect;

@Injectable()
export class RegistrationsService {
    private readonly logger = new Logger(RegistrationsService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly usersService: UsersService,
        private readonly notificationsService: NotificationsService,
        private readonly transactionalEmailService: TransactionalEmailService,
    ) {}

    /** Resolve a academia pelo token do link — mesma "público por omissão" de publicBadgeToken. */
    private async findOrganizationByToken(token: string) {
        const organization = await this.prisma.organization.findFirst({
            where: { publicRegistrationToken: token, publicRegistrationEnabled: true },
            select: { id: true, name: true, logoUrl: true, ...organizationFieldsSelect },
        });
        if (!organization) {
            throw new NotFoundException('Link de cadastro inválido ou desativado.');
        }
        return organization;
    }

    async getPublicFormConfig(token: string, kind: RegistrationKind = RegistrationKind.STUDENT) {
        const organization = await this.findOrganizationByToken(token);
        return {
            organizationName: organization.name,
            organizationLogoUrl: organization.logoUrl,
            enabledFields: registrationFieldsFor(organization, kind),
        };
    }

    async submitPublic(token: string, dto: SubmitRegistrationDto) {
        const organization = await this.findOrganizationByToken(token);
        // Os campos aceitos dependem do papel pedido: cada papel tem a sua lista na academia.
        const requestedKind = dto.requestedKind ?? RegistrationKind.STUDENT;
        const enabledFields = new Set<PublicRegistrationField>(registrationFieldsFor(organization, requestedKind));

        // Duplicata de pending pro mesmo e-mail: ignora silenciosamente (mesma mensagem de
        // sucesso) em vez de erro — não vaza pra quem preenche o form se aquele e-mail já
        // está com uma solicitação em aberto nesta academia.
        const duplicate = await this.prisma.registrationRequest.findFirst({
            where: { organizationId: organization.id, email: dto.email, status: RegistrationRequestStatus.PENDING },
            select: { id: true },
        });

        if (!duplicate) {
            await this.prisma.registrationRequest.create({
                data: {
                    organizationId: organization.id,
                    name: dto.name,
                    email: dto.email,
                    phone: dto.phone,
                    requestedKind,
                    // Nunca confia no payload do cliente pra decidir quais campos opcionais
                    // valem — só grava o que a academia realmente habilitou no momento do envio.
                    birthDate: enabledFields.has('birthDate') && dto.birthDate ? new Date(dto.birthDate) : undefined,
                    baptismDate: enabledFields.has('baptismDate') && dto.baptismDate ? new Date(dto.baptismDate) : undefined,
                    pioneerStatus: enabledFields.has('pioneerStatus') ? dto.pioneerStatus : undefined,
                    signedPetitions: enabledFields.has('signedPetitions') ? dto.signedPetitions : undefined,
                    profession: enabledFields.has('profession') ? dto.profession : undefined,
                },
            });

            await this.notifyReviewers(organization.id, dto.name, requestedKind);
        }

        return { message: 'Cadastro enviado! Assim que for revisado, você receberá um e-mail com os dados de acesso.' };
    }

    async findAll(organizationId: string, query: ListRegistrationsQueryDto) {
        const { status, page = 1, limit = 20 } = query;
        const where: Prisma.RegistrationRequestWhereInput = { organizationId, ...(status ? { status } : {}) };

        const [data, total] = await Promise.all([
            this.prisma.registrationRequest.findMany({
                where,
                select: registrationListSelect,
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
            }),
            this.prisma.registrationRequest.count({ where }),
        ]);

        return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
    }

    async findOne(id: string, organizationId: string) {
        const request = await this.prisma.registrationRequest.findFirst({
            where: { id, organizationId },
            select: registrationListSelect,
        });
        if (!request) {
            throw new NotFoundException(`Solicitação com ID ${id} não encontrada nesta organização.`);
        }
        return request;
    }

    private async requirePending(id: string, organizationId: string) {
        const request = await this.prisma.registrationRequest.findFirst({ where: { id, organizationId } });
        if (!request) {
            throw new NotFoundException(`Solicitação com ID ${id} não encontrada nesta organização.`);
        }
        if (request.status !== RegistrationRequestStatus.PENDING) {
            throw new BadRequestException('Esta solicitação já foi revisada.');
        }
        return request;
    }

    /**
     * Cria a conta a partir de uma solicitação e manda o e-mail de acesso. Compartilhado pela
     * aprovação manual e pelo convite dirigido (que já nasce autorizado por quem convidou).
     * Os dados pessoais são gravados para todos os papéis. O papel decide o resto: aluno ganha perfil de aluno; instrutor fica sem perfil (pronto
     * para ser escalado em turmas); equipe fica sem perfil e já é promovida a integrante da equipe.
     */
    private async createAccountFromRequest(
        request: Prisma.RegistrationRequestGetPayload<Record<string, never>>,
        organizationId: string,
        reviewerId: string | null,
        kind: RegistrationKind,
        overrides: ApproveRegistrationDto = {},
    ): Promise<boolean> {
        const { user, organizationName, activationLink } = await this.usersService.createAccount({
            name: request.name,
            email: request.email,
            phone: request.phone,
            organizationId,
            // Dados pessoais valem para qualquer papel; o perfil de aluno só existe para aluno.
            personProfile: {
                birthDate: overrides.birthDate ?? (request.birthDate ? request.birthDate.toISOString().slice(0, 10) : undefined),
                baptismDate: overrides.baptismDate ?? (request.baptismDate ? request.baptismDate.toISOString().slice(0, 10) : undefined),
                pioneerStatus: overrides.pioneerStatus ?? request.pioneerStatus ?? undefined,
                signedPetitions: overrides.signedPetitions ?? request.signedPetitions,
                profession: overrides.profession ?? request.profession ?? undefined,
            },
            studentProfile: kind === RegistrationKind.STUDENT ? {} : undefined,
            // A promoção nasce junto com a conta (mesma transação) — ver UsersService.createAccount.
            staff: kind === RegistrationKind.STAFF ? { approvedByUserId: reviewerId } : undefined,
        });

        await this.prisma.registrationRequest.update({
            where: { id: request.id },
            data: {
                status: RegistrationRequestStatus.APPROVED,
                reviewedByUserId: reviewerId,
                reviewedAt: new Date(),
                createdUserId: user.id,
                approvedKind: kind,
            },
        });

        // O envio nunca derruba a aprovação (o serviço captura e loga), mas o resultado é gravado:
        // sem isso, uma falha do Resend só existia no log do servidor.
        const sent = await this.transactionalEmailService.sendRegistrationApprovedEmail(
            { name: user.name, email: user.email },
            organizationId,
            organizationName,
            activationLink,
        );
        await this.recordAccessEmail(request.id, sent);
        return sent;
    }

    private recordAccessEmail(requestId: string, sent: boolean) {
        return this.prisma.registrationRequest.update({
            where: { id: requestId },
            data: { accessEmailStatus: sent ? 'SENT' : 'FAILED', accessEmailAt: new Date() },
        });
    }

    async approve(id: string, organizationId: string, reviewerId: string, dto: ApproveRegistrationDto) {
        const request = await this.requirePending(id, organizationId);
        await this.createAccountFromRequest(request, organizationId, reviewerId, dto.kind ?? request.requestedKind, dto);
        return this.findOne(id, organizationId);
    }

    async reject(id: string, organizationId: string, reviewerId: string, dto: RejectRegistrationDto) {
        const request = await this.requirePending(id, organizationId);

        await this.prisma.registrationRequest.update({
            where: { id },
            data: {
                status: RegistrationRequestStatus.REJECTED,
                reviewedByUserId: reviewerId,
                reviewedAt: new Date(),
                rejectionReason: dto.reason,
            },
        });

        if (dto.notify !== false) {
            const organization = await this.prisma.organization.findUniqueOrThrow({ where: { id: organizationId }, select: { name: true } });
            await this.transactionalEmailService.sendRegistrationRejectedEmail(
                { name: request.name, email: request.email },
                organizationId,
                organization.name,
                dto.reason,
            );
        }

        return this.findOne(id, organizationId);
    }

    /** Reenvia o e-mail de acesso de uma solicitação já aprovada (o primeiro envio pode ter falhado ou o link ter vencido). */
    async resendAccess(id: string, organizationId: string) {
        const request = await this.prisma.registrationRequest.findFirst({ where: { id, organizationId } });
        if (!request) {
            throw new NotFoundException(`Solicitação com ID ${id} não encontrada nesta organização.`);
        }
        if (request.status !== RegistrationRequestStatus.APPROVED || !request.createdUserId) {
            throw new BadRequestException('Só é possível reenviar o acesso de um cadastro aprovado.');
        }

        const result = await this.usersService.resendAccess(request.createdUserId, organizationId);
        await this.recordAccessEmail(id, result.sent);
        return { ...result, request: await this.findOne(id, organizationId) };
    }

    /** Avisa (no sino) quem pode revisar que chegou um cadastro novo: admins da academia e quem tem `registrations:manage`. */
    private async notifyReviewers(organizationId: string, personName: string, kind: RegistrationKind) {
        try {
            const reviewers = await this.prisma.user.findMany({
                where: {
                    organizationId,
                    isActive: true,
                    OR: [
                        { role: 'ORG_ADMIN' },
                        { directPermissions: { has: 'registrations:manage' } },
                        { roleAssignments: { some: { permissions: { some: { id: 'registrations:manage' } } } } },
                    ],
                },
                select: { id: true },
            });
            await Promise.all(
                reviewers.map((reviewer) =>
                    this.notificationsService.create({
                        userId: reviewer.id,
                        organizationId,
                        type: 'REGISTRATION_PENDING',
                        title: 'Novo cadastro aguardando revisão',
                        message: `${personName} quer entrar como ${KIND_LABEL[kind]}.`,
                        link: '/registrations',
                    }),
                ),
            );
        } catch (error) {
            // Notificar é acessório: nunca pode impedir a pessoa de enviar o cadastro.
            this.logger.error('Falha ao notificar revisores de um novo cadastro.', (error as Error).stack);
        }
    }

    // ───────────────────────────── convites dirigidos ─────────────────────────────

    private inviteLink(token: string) {
        return `${process.env.FRONTEND_URL}/convite/${token}`;
    }

    private async sendInviteEmail(invite: { id: string; email: string; name: string | null; kind: RegistrationKind; token: string }, organizationId: string) {
        const organization = await this.prisma.organization.findUniqueOrThrow({ where: { id: organizationId }, select: { name: true } });
        const sent = await this.transactionalEmailService.sendRegistrationInviteEmail(
            { name: invite.name, email: invite.email },
            organizationId,
            organization.name,
            KIND_LABEL[invite.kind],
            this.inviteLink(invite.token),
        );
        await this.prisma.registrationInvite.update({
            where: { id: invite.id },
            data: { emailStatus: sent ? 'SENT' : 'FAILED', emailSentAt: new Date() },
        });
        return sent;
    }

    async createInvite(organizationId: string, createdByUserId: string, dto: CreateInviteDto) {
        const email = dto.email.trim().toLowerCase();

        if (await this.prisma.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } }, select: { id: true } })) {
            throw new ConflictException('Já existe uma conta com este e-mail. Use "Reenviar acesso" na tela de Pessoas.');
        }

        // Um convite em aberto por e-mail: convidar de novo troca o anterior (que passa a ser inválido).
        await this.prisma.registrationInvite.updateMany({
            where: { organizationId, email, usedAt: null, revokedAt: null },
            data: { revokedAt: new Date() },
        });

        const invite = await this.prisma.registrationInvite.create({
            data: {
                organizationId,
                email,
                name: dto.name?.trim() || null,
                kind: dto.kind,
                token: crypto.randomBytes(24).toString('hex'),
                createdByUserId,
                expiresAt: new Date(Date.now() + INVITE_TTL_MS),
            },
        });

        const sent = await this.sendInviteEmail(invite, organizationId);
        return { sent, invite: await this.findInvite(invite.id, organizationId) };
    }

    private async findInvite(id: string, organizationId: string) {
        const invite = await this.prisma.registrationInvite.findFirst({ where: { id, organizationId }, select: inviteSelect });
        if (!invite) {
            throw new NotFoundException(`Convite com ID ${id} não encontrado nesta organização.`);
        }
        return withInviteStatus(invite);
    }

    async listInvites(organizationId: string) {
        const invites = await this.prisma.registrationInvite.findMany({
            where: { organizationId },
            select: inviteSelect,
            orderBy: { createdAt: 'desc' },
            take: 100,
        });
        return invites.map(withInviteStatus);
    }

    async resendInvite(id: string, organizationId: string) {
        const invite = await this.prisma.registrationInvite.findFirst({ where: { id, organizationId } });
        if (!invite) {
            throw new NotFoundException(`Convite com ID ${id} não encontrado nesta organização.`);
        }
        if (invite.usedAt || invite.revokedAt) {
            throw new BadRequestException('Este convite já foi usado ou cancelado. Crie um novo convite.');
        }

        const renewed = await this.prisma.registrationInvite.update({ where: { id }, data: { expiresAt: new Date(Date.now() + INVITE_TTL_MS) } });
        const sent = await this.sendInviteEmail(renewed, organizationId);
        return { sent, invite: await this.findInvite(id, organizationId) };
    }

    async revokeInvite(id: string, organizationId: string) {
        const invite = await this.prisma.registrationInvite.findFirst({ where: { id, organizationId } });
        if (!invite) {
            throw new NotFoundException(`Convite com ID ${id} não encontrado nesta organização.`);
        }
        if (invite.usedAt) {
            throw new BadRequestException('Este convite já foi usado.');
        }
        await this.prisma.registrationInvite.update({ where: { id }, data: { revokedAt: invite.revokedAt ?? new Date() } });
        return this.findInvite(id, organizationId);
    }

    /** Convite utilizável = existe, não foi usado nem cancelado e não venceu. Mesma mensagem para todos os casos (não vaza o motivo). */
    private async findUsableInvite(token: string) {
        const invite = await this.prisma.registrationInvite.findFirst({
            where: { token, usedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
            include: { organization: { select: { id: true, name: true, logoUrl: true, ...organizationFieldsSelect } } },
        });
        if (!invite) {
            throw new NotFoundException('Convite inválido, vencido ou já utilizado. Peça um novo convite à academia.');
        }
        return invite;
    }

    async getInviteForm(token: string) {
        const invite = await this.findUsableInvite(token);
        return {
            organizationName: invite.organization.name,
            organizationLogoUrl: invite.organization.logoUrl,
            kind: invite.kind,
            email: invite.email,
            name: invite.name,
            enabledFields: registrationFieldsFor(invite.organization, invite.kind),
        };
    }

    async submitInvite(token: string, dto: SubmitInviteRegistrationDto) {
        const invite = await this.findUsableInvite(token);
        const enabledFields = new Set<PublicRegistrationField>(registrationFieldsFor(invite.organization, invite.kind));

        if (await this.prisma.user.findFirst({ where: { email: { equals: invite.email, mode: 'insensitive' } }, select: { id: true } })) {
            throw new ConflictException('Já existe uma conta com este e-mail. Use "Esqueci minha senha" na tela de login.');
        }

        // Reserva o convite de forma atômica: dois envios simultâneos não criam duas contas.
        const claimed = await this.prisma.registrationInvite.updateMany({
            where: { id: invite.id, usedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
            data: { usedAt: new Date() },
        });
        if (claimed.count === 0) {
            throw new NotFoundException('Convite inválido, vencido ou já utilizado. Peça um novo convite à academia.');
        }

        let emailSent = false;
        try {
            const request = await this.prisma.registrationRequest.create({
                data: {
                    organizationId: invite.organizationId,
                    name: dto.name,
                    email: invite.email,
                    phone: dto.phone,
                    requestedKind: invite.kind,
                    inviteId: invite.id,
                    birthDate: enabledFields.has('birthDate') && dto.birthDate ? new Date(dto.birthDate) : undefined,
                    baptismDate: enabledFields.has('baptismDate') && dto.baptismDate ? new Date(dto.baptismDate) : undefined,
                    pioneerStatus: enabledFields.has('pioneerStatus') ? dto.pioneerStatus : undefined,
                    signedPetitions: enabledFields.has('signedPetitions') ? dto.signedPetitions : undefined,
                    profession: enabledFields.has('profession') ? dto.profession : undefined,
                },
            });
            // O convite é a autorização: quem convidou é registrado como revisor.
            emailSent = await this.createAccountFromRequest(request, invite.organizationId, invite.createdByUserId, invite.kind);
        } catch (error) {
            // Não deixa o convite "queimado" se a conta não chegou a ser criada.
            await this.prisma.registrationInvite.updateMany({ where: { id: invite.id }, data: { usedAt: null } });
            await this.prisma.registrationRequest.deleteMany({ where: { inviteId: invite.id, status: RegistrationRequestStatus.PENDING } });
            throw error;
        }

        return {
            emailSent,
            message: emailSent
                ? 'Cadastro concluído! Enviamos um e-mail com o link para você definir sua senha e acessar o sistema.'
                : 'Cadastro concluído! Não conseguimos enviar o e-mail agora — na tela de login, use "Esqueci minha senha" com este e-mail, ou peça à academia para reenviar o acesso.',
        };
    }
}
