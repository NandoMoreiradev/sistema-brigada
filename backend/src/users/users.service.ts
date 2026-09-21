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
import * as crypto from 'crypto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ListUsersDto } from './dto/list-users.dto';
import { CreateExternalCertificationDto } from './dto/create-external-certification.dto';
import { AuthService } from '../auth/auth.service';
import { TransactionalEmailService } from '../transactional-email/transactional-email.service';

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
    externalCertifications: true,
} satisfies Prisma.UserSelect;

@Injectable()
export class UsersService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly authService: AuthService,
        private readonly transactionalEmailService: TransactionalEmailService,
    ) {}

    async create(dto: CreateUserDto, organizationId: string) {
        const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
        if (existing) {
            throw new ConflictException('Já existe um usuário cadastrado com este e-mail.');
        }

        const organization = await this.prisma.organization.findUniqueOrThrow({ where: { id: organizationId } });

        // Senha aleatória, nunca exposta em lugar nenhum — a pessoa define a própria
        // senha pelo link de ativação do e-mail de boas-vindas (mesmo padrão do
        // admin de academia em organizations.service.ts).
        const hashedPassword = await bcrypt.hash(crypto.randomBytes(24).toString('hex'), 10);

        const user = await this.prisma.$transaction(async (tx) => {
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
                        baptismDate: dto.studentProfile.baptismDate ? new Date(dto.studentProfile.baptismDate) : undefined,
                        pioneerStatus: dto.studentProfile.pioneerStatus,
                        signedPetitions: dto.studentProfile.signedPetitions,
                        profession: dto.studentProfile.profession,
                    },
                });
            }

            return tx.user.findUniqueOrThrow({ where: { id: user.id }, select: userListSelect });
        });

        // Fora da transação e sem `await` — o e-mail não pode impedir nem atrasar a
        // resposta de criação da pessoa (ex: Resend fora do ar/lento).
        // TransactionalEmailService já captura e loga qualquer falha internamente.
        const activationToken = this.authService.createPasswordResetToken(user.id);
        const activationLink = `${process.env.FRONTEND_URL}/reset-password?token=${activationToken}`;
        void this.transactionalEmailService.sendUserWelcomeEmail(
            { name: user.name, email: user.email },
            organizationId,
            organization.name,
            activationLink,
        );

        return user;
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
                    baptismDate: dto.studentProfile.baptismDate ? new Date(dto.studentProfile.baptismDate) : undefined,
                    pioneerStatus: dto.studentProfile.pioneerStatus,
                    signedPetitions: dto.studentProfile.signedPetitions,
                    profession: dto.studentProfile.profession,
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

    /**
     * Versão enxuta de `findAll` (só id+nome, sem e-mail/telefone/cargo) para
     * seletores de pessoa em funcionalidades que são abertas a qualquer
     * autenticado da organização — hoje só a presença de reunião
     * (`meetings.service.ts`: "qualquer usuário pode ser marcado
     * presente/ausente"). Por isso este método não é `@RequirePermission`
     * como `findAll`: expõe só o suficiente pra montar um dropdown, nunca os
     * campos sensíveis da listagem administrativa.
     */
    async findRoster(organizationId: string) {
        return this.prisma.user.findMany({
            where: { organizationId, isActive: true },
            select: { id: true, name: true },
            orderBy: { name: 'asc' },
        });
    }

    /**
     * Decisão 32 do docs/decisoes.md: certificação/qualificação prévia é um
     * fato sobre a pessoa (`User`), não sobre um papel específico — qualquer
     * pessoa cadastrada pode ter uma, esteja ou não promovida a staff de
     * atuação, e independente de ser aluno/instrutor/admin.
     */
    async addExternalCertification(userId: string, organizationId: string, registeredByUserId: string, dto: CreateExternalCertificationDto) {
        const user = await this.prisma.user.findFirst({ where: { id: userId, organizationId } });
        if (!user) {
            throw new NotFoundException(`Usuário com ID ${userId} não encontrado nesta organização.`);
        }

        return this.prisma.externalCertification.create({
            data: {
                userId,
                name: dto.name,
                issuingOrg: dto.issuingOrg,
                issuedAt: dto.issuedAt ? new Date(dto.issuedAt) : undefined,
                expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
                proofFileKey: dto.proofFileKey,
                registeredByUserId,
            },
        });
    }
}
