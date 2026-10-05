// backend/src/courses/teams.service.ts
//
// Equipes fixas de instrutores (ex.: "Equipe de Ana", "Batista/Leandro"). São da academia, como as
// salas: a mesma equipe é escolhida como responsável de atividades em várias turmas. Sem exclusão
// de verdade — equipe que já foi usada só é desativada, para a programação antiga continuar legível.

import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTeamDto, UpdateTeamDto } from './dto/team.dto';
import { INSTRUCTOR_USER_SELECT } from './course-instructors.util';

export const TEAM_INCLUDE = {
    members: { include: { user: INSTRUCTOR_USER_SELECT }, orderBy: { user: { name: 'asc' } } },
} satisfies Prisma.InstructorTeamInclude;

@Injectable()
export class TeamsService {
    constructor(private readonly prisma: PrismaService) {}

    findAll(organizationId: string) {
        return this.prisma.instructorTeam.findMany({ where: { organizationId }, include: TEAM_INCLUDE, orderBy: { name: 'asc' } });
    }

    async create(dto: CreateTeamDto, organizationId: string) {
        const memberIds = await this.assertOrganizationUsers(dto.memberIds, organizationId);
        try {
            return await this.prisma.instructorTeam.create({
                data: { organizationId, name: dto.name.trim(), members: { create: memberIds.map((userId) => ({ userId })) } },
                include: TEAM_INCLUDE,
            });
        } catch (error) {
            throw this.translateUniqueError(error, dto.name);
        }
    }

    async update(id: string, organizationId: string, dto: UpdateTeamDto) {
        const team = await this.prisma.instructorTeam.findFirst({ where: { id, organizationId } });
        if (!team) {
            throw new NotFoundException(`Equipe com ID ${id} não encontrada nesta organização.`);
        }
        const memberIds = dto.memberIds === undefined ? undefined : await this.assertOrganizationUsers(dto.memberIds, organizationId);

        try {
            return await this.prisma.instructorTeam.update({
                where: { id },
                data: {
                    name: dto.name?.trim(),
                    active: dto.active,
                    // Lista enviada substitui os membros.
                    ...(memberIds && { members: { deleteMany: {}, create: memberIds.map((userId) => ({ userId })) } }),
                },
                include: TEAM_INCLUDE,
            });
        } catch (error) {
            throw this.translateUniqueError(error, dto.name);
        }
    }

    private async assertOrganizationUsers(userIds: string[], organizationId: string) {
        const unique = [...new Set(userIds)];
        if (unique.length === 0) {
            throw new BadRequestException('Escolha pelo menos uma pessoa para a equipe.');
        }
        const found = await this.prisma.user.count({ where: { id: { in: unique }, organizationId } });
        if (found !== unique.length) {
            throw new BadRequestException('Há pessoas que não pertencem a esta organização.');
        }
        return unique;
    }

    private translateUniqueError(error: unknown, name?: string) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            return new ConflictException(`Já existe uma equipe chamada "${name?.trim()}".`);
        }
        return error;
    }
}
