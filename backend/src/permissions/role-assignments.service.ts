// backend/src/permissions/role-assignments.service.ts
//
// CRUD de cargo (`RoleAssignment`) por organização. Validações replicadas de
// maskotCrmEdu/backend/src/roles/roles.service.ts: nome duplicado
// (case-insensitive) na mesma organização é rejeitado; cargos com
// `isDeletable=false` (nenhum ainda no MVP, mas o schema já prevê) não podem
// ser editados/excluídos; exclusão é bloqueada se alguém ainda estiver com o
// cargo atribuído — evita apagar um cargo em uso "por baixo dos pés" de quem
// depende dele para acessar o sistema.

import { Injectable, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoleAssignmentDto } from './dto/create-role-assignment.dto';
import { UpdateRoleAssignmentDto } from './dto/update-role-assignment.dto';

@Injectable()
export class RoleAssignmentsService {
    constructor(private readonly prisma: PrismaService) {}

    async create(organizationId: string, dto: CreateRoleAssignmentDto) {
        const existing = await this.prisma.roleAssignment.findFirst({
            where: { organizationId, name: { equals: dto.name, mode: 'insensitive' } },
        });
        if (existing) {
            throw new ConflictException(`Já existe um cargo chamado "${dto.name}" nesta organização.`);
        }

        return this.prisma.roleAssignment.create({
            data: {
                name: dto.name,
                organizationId,
                permissions: { connect: dto.permissionIds.map((id) => ({ id })) },
            },
            include: { permissions: true },
        });
    }

    findAll(organizationId: string) {
        return this.prisma.roleAssignment.findMany({
            where: { organizationId },
            include: { permissions: true, _count: { select: { users: true } } },
            orderBy: { name: 'asc' },
        });
    }

    async findOne(id: string, organizationId: string) {
        const roleAssignment = await this.prisma.roleAssignment.findFirst({
            where: { id, organizationId },
            include: { permissions: true, _count: { select: { users: true } } },
        });
        if (!roleAssignment) {
            throw new NotFoundException(`Cargo com ID ${id} não encontrado nesta organização.`);
        }
        return roleAssignment;
    }

    async update(id: string, organizationId: string, dto: UpdateRoleAssignmentDto) {
        const roleAssignment = await this.findOne(id, organizationId);
        if (!roleAssignment.isDeletable) {
            throw new ForbiddenException('Este cargo é padrão do sistema e não pode ser alterado.');
        }

        if (dto.name) {
            const duplicate = await this.prisma.roleAssignment.findFirst({
                where: { organizationId, name: { equals: dto.name, mode: 'insensitive' }, NOT: { id } },
            });
            if (duplicate) {
                throw new ConflictException(`Já existe um cargo chamado "${dto.name}" nesta organização.`);
            }
        }

        return this.prisma.roleAssignment.update({
            where: { id },
            data: {
                name: dto.name,
                permissions: dto.permissionIds ? { set: dto.permissionIds.map((pid) => ({ id: pid })) } : undefined,
            },
            include: { permissions: true },
        });
    }

    async remove(id: string, organizationId: string) {
        const roleAssignment = await this.findOne(id, organizationId);
        if (!roleAssignment.isDeletable) {
            throw new ForbiddenException('Este cargo é padrão do sistema e não pode ser excluído.');
        }

        const usersWithRole = await this.prisma.user.count({ where: { roleAssignments: { some: { id } } } });
        if (usersWithRole > 0) {
            throw new ForbiddenException(`Este cargo não pode ser excluído: está atribuído a ${usersWithRole} pessoa(s).`);
        }

        await this.prisma.roleAssignment.delete({ where: { id } });
        return { id };
    }
}
