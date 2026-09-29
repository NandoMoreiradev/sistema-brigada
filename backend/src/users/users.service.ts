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
import { StudentProfileDto } from './dto/student-profile.dto';
import { PersonProfileDto } from './dto/person-profile.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ListUsersDto } from './dto/list-users.dto';
import { CreateExternalCertificationDto } from './dto/create-external-certification.dto';
import { AuthService } from '../auth/auth.service';
import { TransactionalEmailService } from '../transactional-email/transactional-email.service';

/** Link de primeiro acesso: mais longo que o de "esqueci a senha" (1h) porque a pessoa pode abrir o e-mail dias depois. */
export const ACTIVATION_TOKEN_TTL = '7d';

/** Converte o DTO de dados pessoais no formato do Prisma (datas em Date). */
function personProfileData(dto: PersonProfileDto) {
    return {
        birthDate: dto.birthDate ? new Date(dto.birthDate) : undefined,
        gender: dto.gender,
        baptismDate: dto.baptismDate ? new Date(dto.baptismDate) : undefined,
        pioneerStatus: dto.pioneerStatus,
        signedPetitions: dto.signedPetitions,
        profession: dto.profession,
    };
}

const userListSelect = {
    id: true,
    name: true,
    email: true,
    phone: true,
    role: true,
    avatarUrl: true,
    isActive: true,
    createdAt: true,
    directPermissions: true,
    studentProfile: true,
    personProfile: true,
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

    /**
     * Miolo de criação de conta reutilizado por `create()` (cadastro manual pela tela de
     * Alunos) e por `RegistrationsService.approve()` (aprovação de autocadastro público) —
     * cria User+StudentProfile e gera o link de ativação, mas não manda e-mail nenhum: cada
     * chamador dispara o gatilho transacional certo (USER_WELCOME vs REGISTRATION_APPROVED)
     * com o link retornado aqui.
     */
    async createAccount(input: {
        name: string;
        email: string;
        phone?: string;
        organizationId: string;
        role?: Role;
        studentProfile?: StudentProfileDto;
        personProfile?: PersonProfileDto;
        /** Promove a pessoa à equipe de atuação na mesma transação da criação da conta. */
        /** Sem revisor (`null`), a própria pessoa consta como quem aprovou. */
        staff?: { approvedByUserId: string | null };
    }) {
        const existing = await this.prisma.user.findUnique({ where: { email: input.email } });
        if (existing) {
            throw new ConflictException('Já existe um usuário cadastrado com este e-mail.');
        }

        const organization = await this.prisma.organization.findUniqueOrThrow({ where: { id: input.organizationId } });

        // Senha aleatória, nunca exposta em lugar nenhum — a pessoa define a própria
        // senha pelo link de ativação do e-mail de boas-vindas (mesmo padrão do
        // admin de academia em organizations.service.ts).
        const hashedPassword = await bcrypt.hash(crypto.randomBytes(24).toString('hex'), 10);

        const user = await this.prisma.$transaction(async (tx) => {
            const user = await tx.user.create({
                data: {
                    name: input.name,
                    email: input.email,
                    password: hashedPassword,
                    phone: input.phone,
                    role: input.role ?? Role.ORG_USER,
                    organizationId: input.organizationId,
                },
            });

            if (input.studentProfile) {
                await tx.studentProfile.create({
                    data: {
                        userId: user.id,
                        organizationId: input.organizationId,
                        healthInfo: input.studentProfile.healthInfo as Prisma.InputJsonValue | undefined,
                        guardianName: input.studentProfile.guardianName,
                        guardianPhone: input.studentProfile.guardianPhone,
                    },
                });
            }

            if (input.personProfile) {
                await tx.personProfile.create({ data: { userId: user.id, organizationId: input.organizationId, ...personProfileData(input.personProfile) } });
            }

            // Na mesma transação: se a promoção falhasse depois da conta criada, sobraria um usuário
            // sem papel e o e-mail já estaria ocupado para uma nova tentativa.
            if (input.staff) {
                await tx.staffMember.create({
                    data: { userId: user.id, organizationId: input.organizationId, approvedByUserId: input.staff.approvedByUserId ?? user.id },
                });
            }

            return tx.user.findUniqueOrThrow({ where: { id: user.id }, select: userListSelect });
        });

        const activationToken = this.authService.createPasswordResetToken(user.id, ACTIVATION_TOKEN_TTL);
        const activationLink = `${process.env.FRONTEND_URL}/reset-password?token=${activationToken}`;

        return { user, organizationName: organization.name, activationLink };
    }

    async create(dto: CreateUserDto, organizationId: string) {
        const { user, organizationName, activationLink } = await this.createAccount({
            name: dto.name,
            email: dto.email,
            phone: dto.phone,
            organizationId,
            role: dto.role,
            studentProfile: dto.studentProfile,
            personProfile: dto.personProfile,
        });

        // Fora da transação e sem `await` — o e-mail não pode impedir nem atrasar a
        // resposta de criação da pessoa (ex: Resend fora do ar/lento).
        // TransactionalEmailService já captura e loga qualquer falha internamente.
        void this.transactionalEmailService.sendUserWelcomeEmail(
            { name: user.name, email: user.email },
            organizationId,
            organizationName,
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

    /**
     * Gera um novo token de redefinição de senha e reenvia o e-mail — pro
     * admin usar quando alguém perde a senha e não quer (ou não consegue)
     * usar o "Esqueci minha senha" da tela de login. Mesmo mecanismo do
     * self-service (AuthService.requestPasswordReset): não muda a senha
     * direto, só manda um novo link; a pessoa define a senha nova ela mesma.
     */
    async sendPasswordReset(id: string, organizationId: string) {
        const user = await this.prisma.user.findFirst({ where: { id, organizationId } });
        if (!user) {
            throw new NotFoundException(`Usuário com ID ${id} não encontrado nesta organização.`);
        }

        const token = this.authService.createPasswordResetToken(user.id);
        const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
        await this.transactionalEmailService.sendPasswordResetEmail(
            { name: user.name, email: user.email, organizationId },
            resetLink,
        );

        return { message: 'E-mail de redefinição de senha enviado.' };
    }

    /**
     * Reenvia o e-mail de primeiro acesso (novo link de 7 dias). Diferente de `sendPasswordReset`
     * (que manda o e-mail de "redefinição"), usa o e-mail de boas-vindas/aprovação, com o mesmo
     * texto que a pessoa deveria ter recebido — e devolve se o envio realmente saiu, porque o
     * envio inicial falha em silêncio.
     */
    async resendAccess(id: string, organizationId: string): Promise<{ sent: boolean; message: string }> {
        const user = await this.prisma.user.findFirst({ where: { id, organizationId }, include: { organization: true } });
        if (!user) {
            throw new NotFoundException(`Usuário com ID ${id} não encontrado nesta organização.`);
        }
        if (!user.isActive) {
            throw new BadRequestException('Esta pessoa está inativa — reative-a antes de reenviar o acesso.');
        }

        const token = this.authService.createPasswordResetToken(user.id, ACTIVATION_TOKEN_TTL);
        const link = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
        const organizationName = user.organization?.name ?? '';

        const fromRegistration = await this.prisma.registrationRequest.findFirst({ where: { createdUserId: user.id }, select: { id: true } });
        const sent = fromRegistration
            ? await this.transactionalEmailService.sendRegistrationApprovedEmail({ name: user.name, email: user.email }, organizationId, organizationName, link)
            : await this.transactionalEmailService.sendUserWelcomeEmail({ name: user.name, email: user.email }, organizationId, organizationName, link);

        return {
            sent,
            message: sent
                ? `E-mail de acesso reenviado para ${user.email}.`
                : 'Não foi possível enviar o e-mail. Confira a configuração de e-mail da academia (Minha Conta › Academia › E-mail).',
        };
    }

    async update(id: string, organizationId: string, dto: UpdateUserDto) {
        const user = await this.prisma.user.findFirst({ where: { id, organizationId }, include: { studentProfile: true, personProfile: true } });
        if (!user) {
            throw new NotFoundException(`Usuário com ID ${id} não encontrado nesta organização.`);
        }

        // Mesma regra da exclusão (user-deletion.service.ts, LAST_ADMIN): desativar o único admin
        // ativo deixa a academia sem ninguém que mande nela — e o "Acessar como" do superadmin
        // (auth.service.ts, impersonateOrganizationAdmin) passa a falhar com "não tem um
        // administrador ativo".
        if (dto.isActive === false && user.isActive && (user.role === Role.ORG_ADMIN || user.role === Role.GROUP_ADMIN)) {
            const otherAdmins = await this.prisma.user.count({
                where: { organizationId, id: { not: id }, isActive: true, role: { in: [Role.ORG_ADMIN, Role.GROUP_ADMIN] } },
            });
            if (otherAdmins === 0) {
                throw new BadRequestException('Esta é a única pessoa administradora ativa da academia — cadastre outra antes de desativá-la.');
            }
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

            if (dto.personProfile) {
                const profileData = personProfileData(dto.personProfile);
                if (user.personProfile) {
                    await tx.personProfile.update({ where: { userId: id }, data: profileData });
                } else {
                    await tx.personProfile.create({ data: { userId: id, organizationId, ...profileData } });
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

    /**
     * Permissões avulsas, direto na pessoa, sem passar por um cargo — combinadas
     * com as do cargo (se tiver um) na resolução de permissões efetivas
     * (ver AuthService.buildOrganizationPermissionsMap). Substitui a lista
     * inteira (igual a `setRoleAssignment` substitui o cargo, não soma).
     */
    async setDirectPermissions(id: string, organizationId: string, permissionIds: string[]) {
        const user = await this.prisma.user.findFirst({ where: { id, organizationId } });
        if (!user) {
            throw new NotFoundException(`Usuário com ID ${id} não encontrado nesta organização.`);
        }

        if (permissionIds.length > 0) {
            const validCount = await this.prisma.permission.count({ where: { id: { in: permissionIds } } });
            if (validCount !== permissionIds.length) {
                throw new BadRequestException('Uma ou mais permissões informadas não existem.');
            }
        }

        await this.prisma.user.update({ where: { id }, data: { directPermissions: permissionIds } });
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
