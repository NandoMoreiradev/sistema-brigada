// backend/src/organizations/organizations.service.ts
//
// CRUD de academias-clientes (tenant). Inspirado no `AdminController`/
// `SchoolOperationsController` do maskotCrmEdu (docs/decisoes.md, tabela de
// reaproveitamento), mas bem mais simples: sem billing/planos/trial (decisão 4
// — sem módulo financeiro no MVP), sem conversão escola-única -> grupo. A
// hierarquia matriz/filial (isMatrix/parentOrganizationId) já é suportada
// diretamente pelos campos do model `Organization`.

import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { ListOrganizationsDto } from './dto/list-organizations.dto';

@Injectable()
export class OrganizationsService {
    constructor(private readonly prisma: PrismaService) {}

    async create(dto: CreateOrganizationDto) {
        if (dto.subdomain) {
            const existing = await this.prisma.organization.findUnique({ where: { subdomain: dto.subdomain } });
            if (existing) {
                throw new ConflictException('Já existe uma academia cadastrada com este subdomínio.');
            }
        }

        if (dto.parentOrganizationId) {
            const parent = await this.prisma.organization.findUnique({ where: { id: dto.parentOrganizationId } });
            if (!parent) {
                throw new NotFoundException('Academia matriz informada não foi encontrada.');
            }
        }

        return this.prisma.organization.create({ data: dto });
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

        return { data: organizations, total, page, limit, totalPages: Math.ceil(total / limit) };
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

        return organization;
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

        return this.prisma.organization.update({ where: { id }, data: dto });
    }

    async remove(id: string) {
        await this.findOne(id);
        return this.prisma.organization.delete({ where: { id } });
    }
}
