// backend/src/registrations/registrations.service.ts
//
// Autocadastro público: alguém sem login preenche o formulário (submitPublic, resolvido
// pelo token da academia — sem subdomínio/tenant por host neste produto, ver
// docs/decisoes.md), a solicitação fica PENDING até um staff com registrations:manage
// aprovar (cria a conta de verdade via UsersService.createAccount, reaproveitando o mesmo
// miolo do cadastro manual pela tela de Alunos) ou recusar (só muda o status).

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, RegistrationRequestStatus } from '@prisma/client';
import { UsersService } from '../users/users.service';
import { TransactionalEmailService } from '../transactional-email/transactional-email.service';
import { SubmitRegistrationDto } from './dto/submit-registration.dto';
import { ApproveRegistrationDto } from './dto/approve-registration.dto';
import { RejectRegistrationDto } from './dto/reject-registration.dto';
import { ListRegistrationsQueryDto } from './dto/list-registrations-query.dto';
import { PublicRegistrationField } from '../common/constants/public-registration-fields.constant';

const registrationListSelect = {
    id: true,
    name: true,
    email: true,
    phone: true,
    baptismDate: true,
    pioneerStatus: true,
    signedPetitions: true,
    profession: true,
    status: true,
    reviewedAt: true,
    rejectionReason: true,
    createdAt: true,
    reviewedBy: { select: { id: true, name: true } },
} satisfies Prisma.RegistrationRequestSelect;

@Injectable()
export class RegistrationsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly usersService: UsersService,
        private readonly transactionalEmailService: TransactionalEmailService,
    ) {}

    /** Resolve a academia pelo token do link — mesma "público por omissão" de publicBadgeToken. */
    private async findOrganizationByToken(token: string) {
        const organization = await this.prisma.organization.findFirst({
            where: { publicRegistrationToken: token, publicRegistrationEnabled: true },
            select: { id: true, name: true, logoUrl: true, publicRegistrationFields: true },
        });
        if (!organization) {
            throw new NotFoundException('Link de cadastro inválido ou desativado.');
        }
        return organization;
    }

    async getPublicFormConfig(token: string) {
        const organization = await this.findOrganizationByToken(token);
        return {
            organizationName: organization.name,
            organizationLogoUrl: organization.logoUrl,
            enabledFields: organization.publicRegistrationFields,
        };
    }

    async submitPublic(token: string, dto: SubmitRegistrationDto) {
        const organization = await this.findOrganizationByToken(token);
        const enabledFields = new Set(organization.publicRegistrationFields as PublicRegistrationField[]);

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
                    // Nunca confia no payload do cliente pra decidir quais campos opcionais
                    // valem — só grava o que a academia realmente habilitou no momento do envio.
                    baptismDate: enabledFields.has('baptismDate') && dto.baptismDate ? new Date(dto.baptismDate) : undefined,
                    pioneerStatus: enabledFields.has('pioneerStatus') ? dto.pioneerStatus : undefined,
                    signedPetitions: enabledFields.has('signedPetitions') ? dto.signedPetitions : undefined,
                    profession: enabledFields.has('profession') ? dto.profession : undefined,
                },
            });
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

    async approve(id: string, organizationId: string, reviewerId: string, dto: ApproveRegistrationDto) {
        const request = await this.requirePending(id, organizationId);

        const { user, organizationName, activationLink } = await this.usersService.createAccount({
            name: request.name,
            email: request.email,
            phone: request.phone,
            organizationId,
            studentProfile: {
                baptismDate: dto.baptismDate ?? (request.baptismDate ? request.baptismDate.toISOString().slice(0, 10) : undefined),
                pioneerStatus: dto.pioneerStatus ?? request.pioneerStatus ?? undefined,
                signedPetitions: dto.signedPetitions ?? request.signedPetitions,
                profession: dto.profession ?? request.profession ?? undefined,
            },
        });

        await this.prisma.registrationRequest.update({
            where: { id },
            data: {
                status: RegistrationRequestStatus.APPROVED,
                reviewedByUserId: reviewerId,
                reviewedAt: new Date(),
                createdUserId: user.id,
            },
        });

        // Fora da transação e sem `await`, mesmo padrão de UsersService.create — o e-mail
        // não pode atrasar/derrubar a aprovação.
        void this.transactionalEmailService.sendRegistrationApprovedEmail(
            { name: user.name, email: user.email },
            organizationId,
            organizationName,
            activationLink,
        );

        return this.findOne(id, organizationId);
    }

    async reject(id: string, organizationId: string, reviewerId: string, dto: RejectRegistrationDto) {
        await this.requirePending(id, organizationId);

        await this.prisma.registrationRequest.update({
            where: { id },
            data: {
                status: RegistrationRequestStatus.REJECTED,
                reviewedByUserId: reviewerId,
                reviewedAt: new Date(),
                rejectionReason: dto.reason,
            },
        });

        return this.findOne(id, organizationId);
    }
}
