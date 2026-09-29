// backend/src/users/user-deletion.service.ts
//
// Exclusão de pessoa (decisão 55 do docs/decisoes.md): soft delete restrito a quem NÃO tem
// histórico. Quem já participou de algo (matrícula, certificado, escala, ocorrência, turma
// ministrada, evento/comunicado criado...) não pode ser excluído — a saída é desativar
// (`isActive: false`), que preserva tudo.
//
// Por que soft delete (e não `delete` físico): o schema mistura FKs `Cascade` (o histórico
// sumiria junto) com FKs sem `onDelete` (o Postgres recusaria), então a exclusão física de quem
// tem histórico é ou destrutiva ou impossível. Sem histórico não há o que perder, mas manter a
// linha (com `deletedAt`) deixa a exclusão acidental recuperável e preserva referências de
// autoria (`approvedByUserId`, `registeredByUserId`...) que são só strings, sem FK.
//
// O que o soft delete puro do `PrismaService` NÃO resolve e este serviço faz à mão:
//   - `User.email` é `@unique`: sem liberar o e-mail, a pessoa não poderia ser cadastrada de novo
//     (o `createAccount` não enxerga o excluído e a inserção estouraria P2002 → 500);
//   - a cascata do soft delete só existe de Organization para baixo: perfil de aluno, equipe,
//     sessões (refresh tokens), integrações etc. continuariam vivos, e os aninhamentos do Prisma
//     (`include: { user }`) não aplicam o filtro `deletedAt`, então a pessoa vazaria em listas.

import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import * as crypto from 'crypto';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';

export interface DeletionBlocker {
    /** Identificador estável para o frontend (não depende do texto). */
    code: string;
    message: string;
    count?: number;
}

export interface DeletionCheck {
    canDelete: boolean;
    blockers: DeletionBlocker[];
    /** Se a pessoa ainda está ativa — o frontend usa para oferecer "Desativar" como alternativa. */
    isActive: boolean;
}

type Db = Prisma.TransactionClient;

type DeletionTarget = { id: string; name: string; email: string; role: Role; isActive: boolean; isSuperAdminRoot: boolean };

const ADMIN_ROLES: Role[] = [Role.SUPER_ADMIN, Role.GROUP_ADMIN, Role.ORG_ADMIN];

/**
 * E-mail da pessoa excluída. Mantém o valor original (recuperável) e continua único por causa do
 * id, liberando o endereço original para um novo cadastro.
 */
export const tombstoneEmail = (id: string, email: string) => `deleted:${id}:${email}`;

/** Fábrica dos bloqueios por histórico: [código, texto (singular/plural), contagem]. */
const plural = (count: number, singular: string, pluralForm: string) => `${count} ${count === 1 ? singular : pluralForm}`;

@Injectable()
export class UserDeletionService {
    private readonly logger = new Logger(UserDeletionService.name);

    constructor(private readonly prisma: PrismaService) {}

    private async findTarget(db: Db, id: string, organizationId: string): Promise<DeletionTarget> {
        const target = await db.user.findFirst({
            where: { id, organizationId },
            select: { id: true, name: true, email: true, role: true, isActive: true, isSuperAdminRoot: true },
        });
        if (!target) {
            throw new NotFoundException(`Usuário com ID ${id} não encontrado nesta organização.`);
        }
        return target;
    }

    /** Tudo que impede a exclusão. Lista vazia = pode excluir. */
    private async collectBlockers(db: Db, target: DeletionTarget, organizationId: string, actor: AuthenticatedUser): Promise<DeletionBlocker[]> {
        const blockers: DeletionBlocker[] = [];

        if (target.id === actor.id) {
            blockers.push({ code: 'SELF', message: 'Você não pode excluir a própria conta.' });
        }
        if (target.role === Role.SUPER_ADMIN || target.role === Role.GROUP_ADMIN || target.isSuperAdminRoot) {
            blockers.push({ code: 'PLATFORM_ROLE', message: 'Administradores de plataforma ou de grupo não podem ser excluídos por aqui.' });
        }
        if (target.role === Role.ORG_ADMIN) {
            // Excluir um admin é a única exclusão que muda quem manda na academia: só outro admin faz isso.
            if (!ADMIN_ROLES.includes(actor.role)) {
                blockers.push({ code: 'ADMIN_REQUIRES_ADMIN', message: 'Só um administrador pode excluir outro administrador.' });
            }
            const otherAdmins = await db.user.count({
                where: { organizationId, id: { not: target.id }, isActive: true, role: { in: [Role.ORG_ADMIN, Role.GROUP_ADMIN] } },
            });
            if (otherAdmins === 0) {
                blockers.push({ code: 'LAST_ADMIN', message: 'Esta é a única pessoa administradora ativa da academia — cadastre outra antes.' });
            }
        }

        const userId = target.id;
        const [
            enrollments,
            certificates,
            designations,
            occurrenceReports,
            occurrenceFiles,
            courseInstructions,
            moduleInstructions,
            sessionInstructions,
            classLogs,
            lessonProgress,
            meetingAttendances,
            createdEvents,
            uploadedEventFiles,
            createdCommunications,
        ] = await Promise.all([
            db.enrollment.count({ where: { studentProfile: { userId } } }),
            db.certificate.count({ where: { enrollment: { studentProfile: { userId } } } }),
            db.designation.count({ where: { staffMember: { userId } } }),
            db.occurrenceReport.count({ where: { createdByUserId: userId } }),
            db.occurrenceReportFile.count({ where: { uploadedByUserId: userId } }),
            db.courseInstructor.count({ where: { userId } }),
            db.courseModuleInstructor.count({ where: { userId } }),
            db.classSessionInstructor.count({ where: { userId } }),
            db.classLog.count({ where: { createdByUserId: userId } }),
            db.lessonProgress.count({ where: { userId } }),
            db.meetingAttendance.count({ where: { userId } }),
            db.event.count({ where: { createdByUserId: userId } }),
            db.eventFile.count({ where: { uploadedByUserId: userId } }),
            db.communication.count({ where: { createdByUserId: userId } }),
        ]);

        const history: Array<[string, number, string]> = [
            ['ENROLLMENTS', enrollments, plural(enrollments, 'matrícula', 'matrículas')],
            ['CERTIFICATES', certificates, plural(certificates, 'certificado', 'certificados')],
            ['DESIGNATIONS', designations, plural(designations, 'escala em evento', 'escalas em eventos')],
            ['OCCURRENCE_REPORTS', occurrenceReports, plural(occurrenceReports, 'relatório de ocorrência', 'relatórios de ocorrência')],
            ['OCCURRENCE_FILES', occurrenceFiles, plural(occurrenceFiles, 'arquivo de ocorrência enviado', 'arquivos de ocorrência enviados')],
            ['COURSE_INSTRUCTIONS', courseInstructions, plural(courseInstructions, 'turma como instrutor(a)', 'turmas como instrutor(a)')],
            ['MODULE_INSTRUCTIONS', moduleInstructions, plural(moduleInstructions, 'módulo como responsável', 'módulos como responsável')],
            ['SESSION_INSTRUCTIONS', sessionInstructions, plural(sessionInstructions, 'aula ministrada', 'aulas ministradas')],
            ['CLASS_LOGS', classLogs, plural(classLogs, 'diário de aula', 'diários de aula')],
            ['LESSON_PROGRESS', lessonProgress, plural(lessonProgress, 'progresso em videoaula', 'progressos em videoaulas')],
            ['MEETING_ATTENDANCES', meetingAttendances, plural(meetingAttendances, 'presença em reunião', 'presenças em reuniões')],
            ['CREATED_EVENTS', createdEvents, plural(createdEvents, 'evento criado', 'eventos criados')],
            ['EVENT_FILES', uploadedEventFiles, plural(uploadedEventFiles, 'arquivo de evento enviado', 'arquivos de evento enviados')],
            ['CREATED_COMMUNICATIONS', createdCommunications, plural(createdCommunications, 'comunicado criado', 'comunicados criados')],
        ];

        for (const [code, count, message] of history) {
            if (count > 0) blockers.push({ code, message, count });
        }

        return blockers;
    }

    private blockersSummary(blockers: DeletionBlocker[]) {
        return blockers.map((b) => b.message.replace(/\.$/, '')).join('; ');
    }

    /** Pré-checagem para a tela: mostra o que impede antes de o admin confirmar. */
    async check(id: string, organizationId: string, actor: AuthenticatedUser): Promise<DeletionCheck> {
        const target = await this.findTarget(this.prisma, id, organizationId);
        const blockers = await this.collectBlockers(this.prisma, target, organizationId, actor);
        return { canDelete: blockers.length === 0, blockers, isActive: target.isActive };
    }

    async remove(id: string, organizationId: string, actor: AuthenticatedUser) {
        if (id === actor.id) {
            throw new BadRequestException('Você não pode excluir a própria conta.');
        }

        // Checagem e exclusão na mesma transação: uma matrícula criada entre a checagem e a
        // exclusão não pode passar despercebida.
        const removed = await this.prisma.$transaction(async (tx) => {
            const target = await this.findTarget(tx, id, organizationId);
            const blockers = await this.collectBlockers(tx, target, organizationId, actor);
            if (blockers.length > 0) {
                throw new ConflictException({
                    message: `Não é possível excluir ${target.name}: ${this.blockersSummary(blockers)}. Desative a pessoa em vez de excluir.`,
                    blockers,
                });
            }

            // Dados que pertencem só à própria pessoa e não têm valor sem ela. Cada `deleteMany`
            // é seguro aqui porque os bloqueios acima garantem que não há histórico dependente
            // (ex.: o StaffMember só some se não tem designações, o StudentProfile só se não tem matrículas).
            await tx.refreshToken.deleteMany({ where: { userId: id } });
            await tx.userIntegration.deleteMany({ where: { userId: id } });
            await tx.notification.deleteMany({ where: { userId: id } });
            await tx.userAvailability.deleteMany({ where: { userId: id } });
            await tx.timeOff.deleteMany({ where: { userId: id } });
            await tx.userOrganizationAccess.deleteMany({ where: { userId: id } });
            await tx.communicationRecipient.deleteMany({ where: { userId: id } });
            await tx.externalCertification.deleteMany({ where: { userId: id } });
            await tx.staffMember.deleteMany({ where: { userId: id } });
            await tx.studentProfile.deleteMany({ where: { userId: id } });
            await tx.personProfile.deleteMany({ where: { userId: id } });

            await tx.user.update({
                where: { id },
                data: {
                    deletedAt: new Date(),
                    isActive: false,
                    email: tombstoneEmail(target.id, target.email),
                    phone: null,
                    avatarUrl: null,
                    // O link público do crachá deixa de valer.
                    publicBadgeToken: crypto.randomUUID(),
                    isTwoFactorEnabled: false,
                    twoFactorSecret: null,
                    twoFactorRecoveryCodes: [],
                    directPermissions: [],
                    roleAssignments: { set: [] },
                },
            });

            return target;
        });

        this.logger.log(`Pessoa ${removed.id} excluída da organização ${organizationId} por ${actor.id}.`);
        return { message: `${removed.name} foi excluído(a).` };
    }
}
