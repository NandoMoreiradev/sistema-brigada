// backend/src/trash/trash.service.ts
//
// Lixeira: lista, restaura e exclui definitivamente o que foi soft-deletado (turma, evento,
// pessoa, cargo). Hoje o `PrismaService` esconde tudo que tem `deletedAt` — sem este serviço
// um item excluído sumia para sempre sem poder ser recuperado nem removido de verdade.
//
// Como a extensão do Prisma funciona (ver prisma/prisma.service.ts):
//   - leituras só enxergam `deletedAt: null`, a menos que o `where` cite `deletedAt` — é o que
//     as listagens daqui fazem (`deletedAt: { not: null }`);
//   - `update`/`updateMany` NÃO são filtrados, então restaurar é só limpar `deletedAt`;
//   - `delete` vira soft delete, a não ser que o `where` leve `hardDelete: true` (exclusão
//     física, só usada pela exclusão definitiva daqui; o campo não existe nos tipos do Prisma,
//     daí o cast).

import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventKind, Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MediaService } from '../media/media.service';

export const TRASH_ENTITIES = ['courses', 'events', 'people', 'roles'] as const;
export type TrashEntity = (typeof TRASH_ENTITIES)[number];

export interface TrashItem {
    id: string;
    name: string;
    deletedAt: Date;
    /** Contexto curto para o admin reconhecer o item (tipo, data, e-mail, nº de matrículas...). */
    description?: string;
}

export interface PurgeCheck {
    name: string;
    /** O que será apagado junto, com contagem (só os itens com `count > 0` entram). */
    items: Array<{ label: string; count: number }>;
    /** Quantos arquivos do storage serão removidos. */
    files: number;
}

export interface RestoreResult {
    message: string;
    /** Efeitos colaterais que o admin precisa saber (ex.: link do Google Meet perdido). */
    warnings: string[];
}

type Db = Prisma.TransactionClient;

const plural = (count: number, singular: string, pluralForm: string) => `${count} ${count === 1 ? singular : pluralForm}`;

/** Mesmo formato de `tombstoneEmail` (users/user-deletion.service.ts): `deleted:<id>:<e-mail original>`. */
const originalEmail = (id: string, email: string) => {
    const prefix = `deleted:${id}:`;
    return email.startsWith(prefix) ? email.slice(prefix.length) : email;
};

const EVENT_KIND_LABEL: Record<EventKind, string> = {
    TURMA: 'Turma',
    ASSEMBLEIA: 'Assembleia',
    CONGRESSO: 'Congresso',
    REUNIAO: 'Reunião',
};

/** Marca o `where` para exclusão física (ver cabeçalho): o campo não existe nos tipos do Prisma. */
const hard = <T extends object>(where: T): T => ({ ...where, hardDelete: true }) as T;

@Injectable()
export class TrashService {
    private readonly logger = new Logger(TrashService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly media: MediaService,
    ) {}

    // ------------------------------------------------------------------ listagem

    async list(entity: TrashEntity, organizationId: string): Promise<TrashItem[]> {
        switch (entity) {
            case 'courses':
                return this.listCourses(organizationId);
            case 'events':
                return this.listEvents(organizationId);
            case 'people':
                return this.listPeople(organizationId);
            case 'roles':
                return this.listRoles(organizationId);
        }
    }

    private async listCourses(organizationId: string): Promise<TrashItem[]> {
        const courses = await this.prisma.course.findMany({
            where: { organizationId, deletedAt: { not: null } },
            include: { event: { select: { title: true } }, _count: { select: { enrollments: true } } },
            orderBy: { deletedAt: 'desc' },
        });
        return courses.map((course) => ({
            id: course.id,
            name: course.event.title,
            deletedAt: course.deletedAt as Date,
            description: [course.category, plural(course._count.enrollments, 'matrícula', 'matrículas')].filter(Boolean).join(' · '),
        }));
    }

    private async listEvents(organizationId: string): Promise<TrashItem[]> {
        const events = await this.prisma.event.findMany({
            where: { organizationId, kind: { not: EventKind.TURMA }, deletedAt: { not: null } },
            orderBy: { deletedAt: 'desc' },
        });
        return events.map((event) => ({
            id: event.id,
            name: event.title,
            deletedAt: event.deletedAt as Date,
            description: `${EVENT_KIND_LABEL[event.kind] ?? event.kind} · ${event.startDate.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`,
        }));
    }

    private async listPeople(organizationId: string): Promise<TrashItem[]> {
        const users = await this.prisma.user.findMany({
            where: { organizationId, role: { in: [Role.ORG_ADMIN, Role.ORG_USER] }, deletedAt: { not: null } },
            select: { id: true, name: true, email: true, deletedAt: true },
            orderBy: { deletedAt: 'desc' },
        });
        return users.map((user) => ({
            id: user.id,
            name: user.name,
            deletedAt: user.deletedAt as Date,
            description: originalEmail(user.id, user.email),
        }));
    }

    private async listRoles(organizationId: string): Promise<TrashItem[]> {
        const roles = await this.prisma.roleAssignment.findMany({
            where: { organizationId, deletedAt: { not: null } },
            include: { _count: { select: { permissions: true } } },
            orderBy: { deletedAt: 'desc' },
        });
        return roles.map((role) => ({
            id: role.id,
            name: role.name,
            deletedAt: role.deletedAt as Date,
            description: plural(role._count.permissions, 'permissão', 'permissões'),
        }));
    }

    // ------------------------------------------------------------------ restaurar

    async restore(entity: TrashEntity, id: string, organizationId: string): Promise<RestoreResult> {
        switch (entity) {
            case 'courses':
                return this.restoreCourse(id, organizationId);
            case 'events':
                return this.restoreEvent(id, organizationId);
            case 'people':
                return this.restorePerson(id, organizationId);
            case 'roles':
                return this.restoreRole(id, organizationId);
        }
    }

    private async requireDeletedCourse(db: Db, id: string, organizationId: string) {
        const course = await db.course.findFirst({
            where: { id, organizationId, deletedAt: { not: null } },
            include: { event: { select: { id: true, title: true } }, _count: { select: { enrollments: true } } },
        });
        if (!course) throw new NotFoundException('Turma não encontrada na lixeira.');
        return course;
    }

    private async restoreCourse(id: string, organizationId: string): Promise<RestoreResult> {
        return this.prisma.$transaction(async (tx) => {
            const course = await this.requireDeletedCourse(tx, id, organizationId);
            const deletedAt = course.deletedAt as Date;

            await tx.event.update({ where: { id: course.eventId }, data: { deletedAt: null } });
            await tx.course.update({ where: { id: course.id }, data: { deletedAt: null } });
            // Só as matrículas removidas junto com a turma (mesmo `deletedAt`).
            const { count } = await tx.enrollment.updateMany({ where: { courseId: course.id, deletedAt }, data: { deletedAt: null } });

            return { message: `Turma "${course.event.title}" restaurada (${plural(count, 'matrícula', 'matrículas')}).`, warnings: [] };
        });
    }

    private async requireDeletedEvent(db: Db, id: string, organizationId: string) {
        const event = await db.event.findFirst({
            where: { id, organizationId, kind: { not: EventKind.TURMA }, deletedAt: { not: null } },
            include: { meeting: { select: { id: true, googleEventId: true } } },
        });
        if (!event) throw new NotFoundException('Evento não encontrado na lixeira.');
        return event;
    }

    private async restoreEvent(id: string, organizationId: string): Promise<RestoreResult> {
        return this.prisma.$transaction(async (tx) => {
            const event = await this.requireDeletedEvent(tx, id, organizationId);
            await tx.event.update({ where: { id: event.id }, data: { deletedAt: null } });

            const warnings: string[] = [];
            if (event.meeting?.googleEventId) {
                // Na exclusão o evento foi apagado do Google Calendar (events.service.ts#remove): o id
                // guardado já não existe lá, e deixá-lo faria a edição da reunião falhar no Google.
                await tx.meeting.update({ where: { id: event.meeting.id }, data: { googleEventId: null, meetUrl: null } });
                warnings.push('O evento da reunião foi removido do Google Calendar na exclusão — o link do Google Meet foi perdido e precisa ser gerado de novo.');
            }

            return { message: `Evento "${event.title}" restaurado.`, warnings };
        });
    }

    private async restorePerson(id: string, organizationId: string): Promise<RestoreResult> {
        const user = await this.prisma.user.findFirst({
            where: { id, organizationId, role: { in: [Role.ORG_ADMIN, Role.ORG_USER] }, deletedAt: { not: null } },
            select: { id: true, name: true, email: true },
        });
        if (!user) throw new NotFoundException('Pessoa não encontrada na lixeira.');

        const email = originalEmail(user.id, user.email);
        if (email !== user.email) {
            // `findFirst` só enxerga quem não está excluído; é exatamente quem pode ter ocupado o e-mail.
            const taken = await this.prisma.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } }, select: { id: true } });
            if (taken) {
                throw new ConflictException(`O e-mail ${email} já foi cadastrado para outra pessoa — não é possível restaurar ${user.name} sem conflito.`);
            }
        }

        try {
            await this.prisma.user.update({ where: { id: user.id }, data: { deletedAt: null, isActive: false, email } });
        } catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
                throw new ConflictException(`O e-mail ${email} já foi cadastrado para outra pessoa — não é possível restaurar ${user.name} sem conflito.`);
            }
            throw error;
        }

        return {
            message: `${user.name} foi restaurado(a) como conta inativa.`,
            warnings: [
                'A conta volta inativa e sem perfil de aluno, equipe, cargos nem integrações (apagados na exclusão). Reative a pessoa e readicione os perfis em Pessoas.',
            ],
        };
    }

    private async restoreRole(id: string, organizationId: string): Promise<RestoreResult> {
        const role = await this.prisma.roleAssignment.findFirst({ where: { id, organizationId, deletedAt: { not: null } } });
        if (!role) throw new NotFoundException('Cargo não encontrado na lixeira.');

        const duplicate = await this.prisma.roleAssignment.findFirst({
            where: { organizationId, name: { equals: role.name, mode: 'insensitive' } },
            select: { id: true },
        });
        if (duplicate) {
            throw new ConflictException(`Já existe outro cargo chamado "${role.name}" — renomeie ou exclua esse cargo antes de restaurar.`);
        }

        await this.prisma.roleAssignment.update({ where: { id: role.id }, data: { deletedAt: null } });
        return { message: `Cargo "${role.name}" restaurado.`, warnings: [] };
    }

    // ------------------------------------------------------------------ exclusão definitiva

    async purgeCheck(entity: TrashEntity, id: string, organizationId: string): Promise<PurgeCheck> {
        const plan = await this.buildPurgePlan(this.prisma, entity, id, organizationId);
        return { name: plan.name, items: plan.items.filter((item) => item.count > 0), files: plan.fileKeys.length };
    }

    async purge(entity: TrashEntity, id: string, organizationId: string): Promise<{ message: string }> {
        const plan = await this.buildPurgePlan(this.prisma, entity, id, organizationId);

        try {
            await plan.execute();
        } catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
                // FK sem cascade apontando para o registro: melhor recusar do que apagar às cegas.
                throw new ConflictException(`Não é possível excluir "${plan.name}" definitivamente: ainda há registros vinculados a ele.`);
            }
            throw error;
        }

        // Só depois do commit: se o banco recusou, nenhum arquivo foi tocado.
        await Promise.all(plan.fileKeys.map((key) => this.media.deleteObject(key)));
        this.logger.log(`Exclusão definitiva de ${entity}/${id} (org ${organizationId}): ${plan.fileKeys.length} arquivo(s) removido(s) do storage.`);
        return { message: `"${plan.name}" foi excluído(a) definitivamente.` };
    }

    private async buildPurgePlan(
        db: PrismaService | Db,
        entity: TrashEntity,
        id: string,
        organizationId: string,
    ): Promise<{ name: string; items: Array<{ label: string; count: number }>; fileKeys: string[]; execute: () => Promise<unknown> }> {
        switch (entity) {
            case 'courses': {
                const course = await this.requireDeletedCourse(db as Db, id, organizationId);
                const [certificates, sessions, modules, lessons, videos, pdfs] = await Promise.all([
                    db.certificate.count({ where: { enrollment: { courseId: id } } }),
                    db.classSession.count({ where: { courseId: id } }),
                    db.courseModule.count({ where: { courseId: id } }),
                    db.courseLesson.count({ where: { module: { courseId: id } } }),
                    db.courseLesson.findMany({ where: { module: { courseId: id }, videoKey: { not: null } }, select: { videoKey: true } }),
                    db.certificate.findMany({ where: { enrollment: { courseId: id }, pdfKey: { not: null } }, select: { pdfKey: true } }),
                ]);
                return {
                    name: course.event.title,
                    items: [
                        // `_count` aninhado não passa pelo filtro de soft delete: conta também as matrículas excluídas junto.
                        { label: 'matrículas', count: course._count.enrollments },
                        { label: 'certificados emitidos', count: certificates },
                        { label: 'aulas agendadas', count: sessions },
                        { label: 'módulos', count: modules },
                        { label: 'videoaulas e conteúdos', count: lessons },
                    ],
                    fileKeys: [...videos.map((v) => v.videoKey), ...pdfs.map((p) => p.pdfKey)].filter((k): k is string => !!k),
                    // Apagar o Event leva Course, sessões, módulos, matrículas e certificados pelo `onDelete: Cascade`.
                    execute: () => this.prisma.event.delete({ where: hard({ id: course.eventId }) }),
                };
            }

            case 'events': {
                const event = await this.requireDeletedEvent(db as Db, id, organizationId);
                const [files, reports, reportFiles, shifts, designations, plans, keysA, keysB, keysC] = await Promise.all([
                    db.eventFile.count({ where: { eventId: id } }),
                    db.occurrenceReport.count({ where: { eventOperation: { eventId: id } } }),
                    db.occurrenceReportFile.count({ where: { occurrenceReport: { eventOperation: { eventId: id } } } }),
                    db.eventShift.count({ where: { eventOperation: { eventId: id } } }),
                    db.designation.count({ where: { eventOperation: { eventId: id } } }),
                    db.eventFloorPlan.count({ where: { eventOperation: { eventId: id } } }),
                    db.eventFile.findMany({ where: { eventId: id, storageKey: { not: null } }, select: { storageKey: true } }),
                    db.occurrenceReportFile.findMany({
                        where: { occurrenceReport: { eventOperation: { eventId: id } }, storageKey: { not: null } },
                        select: { storageKey: true },
                    }),
                    db.eventFloorPlan.findMany({ where: { eventOperation: { eventId: id }, imageKey: { not: null } }, select: { imageKey: true } }),
                ]);
                const legacyPlan = await db.eventOperation.findUnique({ where: { eventId: id }, select: { floorPlanKey: true } });
                return {
                    name: event.title,
                    items: [
                        { label: 'arquivos anexados', count: files },
                        { label: 'relatórios de ocorrência', count: reports },
                        { label: 'anexos de ocorrência', count: reportFiles },
                        { label: 'turnos', count: shifts },
                        { label: 'escalas de equipe', count: designations },
                        { label: 'plantas baixas', count: plans },
                    ],
                    fileKeys: [
                        ...keysA.map((k) => k.storageKey),
                        ...keysB.map((k) => k.storageKey),
                        ...keysC.map((k) => k.imageKey),
                        legacyPlan?.floorPlanKey,
                    ].filter((k): k is string => !!k),
                    execute: () => this.prisma.event.delete({ where: hard({ id: event.id }) }),
                };
            }

            case 'people': {
                const user = await db.user.findFirst({
                    where: { id, organizationId, role: { in: [Role.ORG_ADMIN, Role.ORG_USER] }, deletedAt: { not: null } },
                    select: { id: true, name: true },
                });
                if (!user) throw new NotFoundException('Pessoa não encontrada na lixeira.');
                return {
                    name: user.name,
                    // A exclusão (soft) só é permitida sem histórico e já apagou os dados da pessoa: resta a conta.
                    items: [],
                    fileKeys: [],
                    execute: () => this.prisma.user.delete({ where: hard({ id: user.id }) }),
                };
            }

            case 'roles': {
                const role = await db.roleAssignment.findFirst({ where: { id, organizationId, deletedAt: { not: null } } });
                if (!role) throw new NotFoundException('Cargo não encontrado na lixeira.');
                return {
                    name: role.name,
                    items: [],
                    fileKeys: [],
                    execute: () => this.prisma.roleAssignment.delete({ where: hard({ id: role.id }) }),
                };
            }
        }
    }

    static assertEntity(value: string): TrashEntity {
        if (!(TRASH_ENTITIES as readonly string[]).includes(value)) {
            throw new BadRequestException(`Tipo de lixeira inválido: ${value}. Use ${TRASH_ENTITIES.join(', ')}.`);
        }
        return value as TrashEntity;
    }
}
