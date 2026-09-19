// backend/src/organizations/organizations.service.ts
//
// CRUD de academias-clientes (tenant). Inspirado no `AdminController`/
// `SchoolOperationsController` do maskotCrmEdu (docs/decisoes.md, tabela de
// reaproveitamento), mas bem mais simples: sem billing/planos/trial (decisão 4
// — sem módulo financeiro no MVP), sem conversão escola-única -> grupo. A
// hierarquia matriz/filial (isMatrix/parentOrganizationId) já é suportada
// diretamente pelos campos do model `Organization`.

import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { ListOrganizationsDto } from './dto/list-organizations.dto';
import { AuthService } from '../auth/auth.service';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { TransactionalEmailService } from '../transactional-email/transactional-email.service';

@Injectable()
export class OrganizationsService {
    private readonly logger = new Logger(OrganizationsService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly authService: AuthService,
        private readonly transactionalEmailService: TransactionalEmailService,
    ) {}

    async create(dto: CreateOrganizationDto) {
        const { adminName, adminEmail, ...organizationData } = dto;

        if (organizationData.subdomain) {
            const existing = await this.prisma.organization.findUnique({ where: { subdomain: organizationData.subdomain } });
            if (existing) {
                throw new ConflictException('Já existe uma academia cadastrada com este subdomínio.');
            }
        }

        if (organizationData.parentOrganizationId) {
            const parent = await this.prisma.organization.findUnique({ where: { id: organizationData.parentOrganizationId } });
            if (!parent) {
                throw new NotFoundException('Academia matriz informada não foi encontrada.');
            }
        }

        const existingAdmin = await this.prisma.user.findUnique({ where: { email: adminEmail } });
        if (existingAdmin) {
            throw new ConflictException('Já existe um usuário cadastrado com este e-mail.');
        }

        // Senha aleatória, nunca exposta em lugar nenhum — o admin define a própria senha
        // pelo link de ativação do e-mail de boas-vindas (mesmo fluxo de "redefinir senha").
        const hashedPassword = await bcrypt.hash(crypto.randomBytes(24).toString('hex'), 10);

        const { organization, admin } = await this.prisma.$transaction(async (tx) => {
            const organization = await tx.organization.create({ data: organizationData });
            const admin = await tx.user.create({
                data: {
                    name: adminName,
                    email: adminEmail,
                    password: hashedPassword,
                    role: Role.ORG_ADMIN,
                    organizationId: organization.id,
                },
            });
            return { organization, admin };
        });

        // Fora da transação e sem `await` — o e-mail não pode impedir nem atrasar a resposta
        // de criação da academia (ex: Resend fora do ar/lento). TransactionalEmailService já
        // captura e loga qualquer falha de envio internamente, sem propagar exceção.
        const activationToken = this.authService.createPasswordResetToken(admin.id);
        const activationLink = `${process.env.FRONTEND_URL}/reset-password?token=${activationToken}`;
        void this.transactionalEmailService.sendOrganizationAdminWelcomeEmail(
            { name: admin.name, email: admin.email, organizationId: organization.id },
            organization.name,
            activationLink,
        );

        return organization;
    }

    async findAll(query: ListOrganizationsDto) {
        const { search, page = 1, limit = 20 } = query;

        const where: Prisma.OrganizationWhereInput = search
            ? { name: { contains: search, mode: 'insensitive' } }
            : {};

        const [organizations, total] = await Promise.all([
            this.prisma.organization.findMany({
                where,
                orderBy: { name: 'asc' },
                skip: (page - 1) * limit,
                take: limit,
                include: {
                    parentOrganization: { select: { id: true, name: true } },
                    _count: { select: { users: true, courses: true, childOrganizations: true } },
                },
            }),
            this.prisma.organization.count({ where }),
        ]);

        return { data: organizations.map((org) => this.maskResendKey(org)), total, page, limit, totalPages: Math.ceil(total / limit) };
    }

    async findOne(id: string) {
        const organization = await this.prisma.organization.findUnique({
            where: { id },
            include: {
                parentOrganization: { select: { id: true, name: true } },
                childOrganizations: { select: { id: true, name: true } },
                certificateTemplate: true,
                _count: { select: { users: true, courses: true, events: true } },
            },
        });

        if (!organization) {
            throw new NotFoundException(`Academia com ID ${id} não encontrada.`);
        }

        return this.maskResendKey(organization);
    }

    async update(id: string, dto: UpdateOrganizationDto) {
        await this.findOne(id);

        if (dto.subdomain) {
            const existing = await this.prisma.organization.findFirst({
                where: { subdomain: dto.subdomain, NOT: { id } },
            });
            if (existing) {
                throw new ConflictException('Já existe uma academia cadastrada com este subdomínio.');
            }
        }

        const updated = await this.prisma.organization.update({ where: { id }, data: dto });
        return this.maskResendKey(updated);
    }

    /**
     * A chave Resend nunca volta em texto puro pra fora do backend — só um booleano dizendo
     * se a academia já tem uma configurada. Evita expor a credencial em qualquer resposta de
     * GET/listagem; ela só é gravada (write-only) via `update()`.
     */
    private maskResendKey<T extends { resendApiKey?: string | null }>(organization: T): Omit<T, 'resendApiKey'> & { hasCustomResendKey: boolean } {
        const { resendApiKey, ...rest } = organization;
        return { ...rest, hasCustomResendKey: !!resendApiKey };
    }

    async remove(id: string) {
        await this.findOne(id);
        return this.prisma.organization.delete({ where: { id } });
    }

    async impersonate(id: string, admin: AuthenticatedUser) {
        await this.findOne(id);
        return this.authService.impersonateOrganizationAdmin(id, {
            id: admin.id,
            name: admin.name,
            email: admin.email,
        });
    }
}
