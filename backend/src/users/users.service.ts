// backend/src/users/users.service.ts
//
// Gestão de pessoas (alunos/instrutores/admins de unidade) dentro de uma
// organização. Reaproveita o próprio model `User` do auth (decisão 8 do
// docs/decisoes.md) em vez de um cadastro de "aluno" separado — criar um
// usuário aqui com `studentProfile` é o equivalente ao antigo
// `StudentsService.enrollStudent()` do maskotCrmEdu, mas sem lead/financeiro:
// só cria a pessoa. A matrícula em si (Enrollment) é responsabilidade do
// módulo `courses` (ver `enrollments.service.ts`).

import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ListUsersDto } from './dto/list-users.dto';

const userListSelect = {
    id: true,
    name: true,
    email: true,
    phone: true,
    role: true,
    avatarUrl: true,
    isActive: true,
    createdAt: true,
    studentProfile: true,
    staffMember: { select: { id: true, status: true } },
    instructorAssignments: { select: { courseId: true } },
    roleAssignments: { select: { id: true, name: true } },
} satisfies Prisma.UserSelect;

@Injectable()
export class UsersService {
    constructor(private readonly prisma: PrismaService) {}

    async create(dto: CreateUserDto, organizationId: string) {
        const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
        if (existing) {
            throw new ConflictException('Já existe um usuário cadastrado com este e-mail.');
        }

        const hashedPassword = await bcrypt.hash(dto.password, 10);

        return this.prisma.$transaction(async (tx) => {
            const user = await tx.user.create({
                data: {
                    name: dto.name,
                    email: dto.email,
                    password: hashedPassword,
                    phone: dto.phone,
                    role: dto.role ?? Role.ORG_USER,
                    organizationId,
                },
            });

            if (dto.studentProfile) {
                await tx.studentProfile.create({
                    data: {
                        userId: user.id,
                        organizationId,
                        birthDate: dto.studentProfile.birthDate ? new Date(dto.studentProfile.birthDate) : undefined,
                        gender: dto.studentProfile.gender,
                        healthInfo: dto.studentProfile.healthInfo as Prisma.InputJsonValue | undefined,
                        guardianName: dto.studentProfile.guardianName,
                        guardianPhone: dto.studentProfile.guardianPhone,
                    },
                });
            }

            return tx.user.findUniqueOrThrow({ where: { id: user.id }, select: userListSelect });
        });
    }

    async findAll(organizationId: string, query: ListUsersDto) {
        const { search, role, hasStudentProfile, page = 1, limit = 20 } = query;

        const where: Prisma.UserWhereInput = { organizationId };

        if (role) {
            where.role = role;
        }

        if (hasStudentProfile !== undefined) {
            where.studentProfile = hasStudentProfile ? { isNot: null } : { is: null };
        }

        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
            ];
        }

        const [users, total] = await Promise.all([
            this.prisma.user.findMany({
                where,
                select: userListSelect,
                orderBy: { name: 'asc' },
                skip: (page - 1) * limit,
                take: limit,
            }),
            this.prisma.user.count({ where }),
        ]);

        return { data: users, total, page, limit, totalPages: Math.ceil(total / limit) };
    }

    async findOne(id: string, organizationId: string) {
        const user = await this.prisma.user.findFirst({
            where: { id, organizationId },
            select: {
                ...userListSelect,
                instructorAssignments: {
                    select: { course: { select: { id: true, event: { select: { title: true } } } } },
                },
            },
        });

        if (!user) {
            throw new NotFoundException(`Usuário com ID ${id} não encontrado nesta organização.`);
        }

        return user;
    }

    async update(id: string, organizationId: string, dto: UpdateUserDto) {
        const user = await this.prisma.user.findFirst({ where: { id, organizationId }, include: { studentProfile: true } });
        if (!user) {
            throw new NotFoundException(`Usuário com ID ${id} não encontrado nesta organização.`);
        }

        return this.prisma.$transaction(async (tx) => {
            await tx.user.update({
                where: { id },
                data: {
                    name: dto.name,
                    phone: dto.phone,
                    isActive: dto.isActive,
                },
            });

            if (dto.studentProfile) {
                const profileData = {
                    birthDate: dto.studentProfile.birthDate ? new Date(dto.studentProfile.birthDate) : undefined,
                    gender: dto.studentProfile.gender,
                    healthInfo: dto.studentProfile.healthInfo as Prisma.InputJsonValue | undefined,
                    guardianName: dto.studentProfile.guardianName,
                    guardianPhone: dto.studentProfile.guardianPhone,
                };

                if (user.studentProfile) {
                    await tx.studentProfile.update({ where: { userId: id }, data: profileData });
                } else {
                    await tx.studentProfile.create({ data: { userId: id, organizationId, ...profileData } });
                }
            }

            return tx.user.findUniqueOrThrow({ where: { id }, select: userListSelect });
        });
    }

    /**
     * Atribui (ou remove, com `roleAssignmentId: null`) o cargo de uma pessoa.
     * `User.roleAssignments` é M:N no schema, mas tratamos como "um cargo por
     * vez" aqui — `set` substitui a lista inteira em vez de `connect` somar.
     */
    async setRoleAssignment(id: string, organizationId: string, roleAssignmentId: string | null) {
        const user = await this.prisma.user.findFirst({ where: { id, organizationId } });
        if (!user) {
            throw new NotFoundException(`Usuário com ID ${id} não encontrado nesta organização.`);
        }

        if (roleAssignmentId) {
            const roleAssignment = await this.prisma.roleAssignment.findFirst({
                where: { id: roleAssignmentId, organizationId },
            });
            if (!roleAssignment) {
                throw new BadRequestException('Cargo informado não pertence a esta organização.');
            }
        }

        await this.prisma.user.update({
            where: { id },
            data: { roleAssignments: { set: roleAssignmentId ? [{ id: roleAssignmentId }] : [] } },
        });

        return this.findOne(id, organizationId);
    }

    /** Resolve o StudentProfile de um usuário da organização — usado pelo módulo de matrícula. */
    async requireStudentProfile(userId: string, organizationId: string) {
        const user = await this.prisma.user.findFirst({
            where: { id: userId, organizationId },
            include: { studentProfile: true },
        });

        if (!user) {
            throw new NotFoundException(`Usuário com ID ${userId} não encontrado nesta organização.`);
        }

        if (!user.studentProfile) {
            throw new BadRequestException(
                'Este usuário não possui perfil de aluno. Crie o perfil de aluno antes de matricular.',
            );
        }

        return user.studentProfile;
    }
}
