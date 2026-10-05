// backend/src/courses/course-schedule.service.ts
//
// Programação da turma (ver o comentário "PROGRAMAÇÃO DA TURMA" em schema.prisma):
// - Grupos: quem (alunos). Cada aluno fica em um grupo; a chamada de um período mostra só ele.
// - Atividades: cadastradas uma vez na turma (duração, local fixo, responsáveis).
// - Dia de um grupo: sequência de atividades a partir de um horário de início. Os horários de
//   cada bloco são CALCULADOS aqui — na planilha eram digitados à mão e saíam errados.
// - Chamada por período: cada trecho do dia entre refeições (manhã/tarde) vira uma ClassSession
//   `fromSchedule`, que é onde a chamada é feita e o que conta para o certificado. Mexer na
//   programação reajusta esses períodos; um período com chamada lançada não pode sumir.
// - Conflitos (sala ocupada, pessoa em dois lugares) são avisos, não bloqueios: no meio da
//   montagem de um rodízio é normal passar por estados inválidos.
//
// Quem é escolhido como responsável de uma atividade (pessoa ou membro de equipe) vira instrutor
// da turma automaticamente: é o que permite a ele fazer a chamada e ver a turma.

import { Injectable, NotFoundException, BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { Prisma, ScheduleActivityKind } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RoomsService } from './rooms.service';
import { TEAM_INCLUDE } from './teams.service';
import { INSTRUCTOR_USER_SELECT } from './course-instructors.util';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { userHasPermission } from '../auth/common/user-has-permission.util';
import {
    ActivityAssigneeDto,
    ApplyTemplateDto,
    AssignGroupsDto,
    CreateActivityDto,
    CreateGroupDto,
    SaveScheduleDayDto,
    UpdateActivityDto,
    UpdateGroupDto,
} from './dto/course-schedule.dto';

type Tx = Prisma.TransactionClient;
type CourseRef = { id: string; organizationId: string; defaultRoomId: string | null };

const ACTIVITY_INCLUDE = {
    room: true,
    assignees: { include: { team: { include: TEAM_INCLUDE }, user: INSTRUCTOR_USER_SELECT } },
} satisfies Prisma.CourseActivityInclude;

const GROUP_INCLUDE = {
    room: true,
    _count: { select: { enrollments: true } },
} satisfies Prisma.CourseGroupInclude;

/** Montar um rodízio inteiro (3 grupos x 20+ atividades) passa do limite padrão de 5s de transação. */
const LONG_TRANSACTION = { timeout: 30_000, maxWait: 10_000 };

const DAY_MS = 24 * 60 * 60 * 1000;

export interface ScheduleConflict {
    type: 'ROOM' | 'PERSON';
    date: string;
    message: string;
    blockIds: string[];
}

interface TemplateData {
    version: 1;
    groups: { key: string; name: string; roomId: string | null }[];
    activities: {
        key: string;
        title: string;
        kind: ScheduleActivityKind;
        durationMinutes: number;
        roomId: string | null;
        assignees: { teamId: string | null; userId: string | null }[];
    }[];
    days: { dayOffset: number; groupKey: string | null; startTime: string; activityKeys: string[] }[];
}

const toMinutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
const fromMinutes = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
/** "2026-10-11" (ou ISO completo) -> meia-noite UTC, o formato das colunas `@db.Date`. */
const toDateOnly = (value: string | Date) => new Date(`${(typeof value === 'string' ? value : value.toISOString()).slice(0, 10)}T00:00:00.000Z`);
const dateKey = (date: Date) => date.toISOString().slice(0, 10);

function periodLabel(startTime: string) {
    const minutes = toMinutes(startTime);
    if (minutes < 12 * 60) return 'Manhã';
    if (minutes < 18 * 60) return 'Tarde';
    return 'Noite';
}

@Injectable()
export class CourseScheduleService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly roomsService: RoomsService,
    ) {}

    // ───────────────────────────── leitura ─────────────────────────────

    /**
     * Coordenação e instrutores veem tudo (com conflitos). Aluno vê só a programação do grupo
     * dele (e a da turma inteira), sem conflitos.
     */
    async getSchedule(courseId: string, organizationId: string, user: AuthenticatedUser) {
        await this.requireCourse(courseId, organizationId);

        const isStaff =
            userHasPermission(user, 'courses:manage') ||
            Boolean(await this.prisma.courseInstructor.findFirst({ where: { courseId, userId: user.id }, select: { id: true } }));

        let studentGroupId: string | null | undefined;
        if (!isStaff) {
            const enrollment = await this.prisma.enrollment.findFirst({ where: { courseId, studentProfile: { userId: user.id } }, select: { groupId: true } });
            if (!enrollment) {
                throw new ForbiddenException('Você não faz parte desta turma.');
            }
            studentGroupId = enrollment.groupId;
        }
        const groupScope = isStaff ? {} : { OR: [{ groupId: null }, ...(studentGroupId ? [{ groupId: studentGroupId }] : [])] };

        const [groups, activities, blocks] = await Promise.all([
            this.prisma.courseGroup.findMany({
                where: { courseId, ...(isStaff ? {} : { id: studentGroupId ?? '__nenhum__' }) },
                include: GROUP_INCLUDE,
                orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
            }),
            this.prisma.courseActivity.findMany({ where: { courseId }, include: ACTIVITY_INCLUDE, orderBy: [{ order: 'asc' }, { createdAt: 'asc' }] }),
            this.prisma.scheduleBlock.findMany({ where: { courseId, ...groupScope }, orderBy: [{ date: 'asc' }, { order: 'asc' }] }),
        ]);

        return {
            groups,
            activities,
            blocks,
            conflicts: isStaff ? await this.findConflicts(courseId, organizationId) : [],
        };
    }

    /**
     * Sala ocupada por duas atividades ao mesmo tempo, ou pessoa (direta ou via equipe) em dois
     * lugares ao mesmo tempo. Olha a academia inteira nos dias em que esta turma tem programação
     * (outra turma pode estar usando a mesma sala ou o mesmo instrutor), mas só devolve conflitos
     * que envolvem esta turma.
     */
    async findConflicts(courseId: string, organizationId: string): Promise<ScheduleConflict[]> {
        const days = await this.prisma.scheduleBlock.findMany({ where: { courseId }, select: { date: true }, distinct: ['date'] });
        if (days.length === 0) return [];
        const dates = days.map((d) => d.date);

        const [blocks, manualSessions] = await Promise.all([
            this.prisma.scheduleBlock.findMany({
                where: { date: { in: dates }, course: { organizationId, deletedAt: null }, activity: { kind: ScheduleActivityKind.ACTIVITY } },
                include: {
                    group: { include: { room: true } },
                    course: { select: { id: true, defaultRoomId: true, event: { select: { title: true } } } },
                    activity: {
                        include: {
                            room: true,
                            assignees: {
                                include: {
                                    user: INSTRUCTOR_USER_SELECT,
                                    team: { include: { members: { include: { user: INSTRUCTOR_USER_SELECT } } } },
                                },
                            },
                        },
                    },
                },
            }),
            // Aulas avulsas (fora da programação) também ocupam sala.
            this.prisma.classSession.findMany({
                where: { date: { in: dates }, fromSchedule: false, roomId: { not: null }, course: { organizationId, deletedAt: null } },
                include: { room: true, group: true, course: { select: { id: true, event: { select: { title: true } } } } },
            }),
        ]);

        const roomIds = new Set<string>();
        type Item = { id: string; courseId: string; date: string; start: number; end: number; startTime: string; endTime: string; who: string; what: string; roomId: string | null; people: Map<string, string> };
        const items: Item[] = [];

        for (const block of blocks) {
            const roomId = block.activity.roomId ?? block.group?.roomId ?? block.course.defaultRoomId;
            if (roomId) roomIds.add(roomId);
            const people = new Map<string, string>();
            for (const assignee of block.activity.assignees) {
                if (assignee.user) people.set(assignee.user.id, assignee.user.name);
                assignee.team?.members.forEach((member) => people.set(member.user.id, member.user.name));
            }
            const groupName = block.group?.name ?? 'turma inteira';
            items.push({
                id: block.id,
                courseId: block.courseId,
                date: dateKey(block.date),
                start: toMinutes(block.startTime),
                end: toMinutes(block.endTime),
                startTime: block.startTime,
                endTime: block.endTime,
                who: block.courseId === courseId ? groupName : `${block.course.event.title} · ${groupName}`,
                what: block.activity.title,
                roomId,
                people,
            });
        }
        for (const session of manualSessions) {
            items.push({
                id: session.id,
                courseId: session.courseId,
                date: dateKey(session.date),
                start: toMinutes(session.startTime),
                end: toMinutes(session.endTime),
                startTime: session.startTime,
                endTime: session.endTime,
                who: session.courseId === courseId ? (session.group?.name ?? 'turma inteira') : session.course.event.title,
                what: session.topic || 'aula avulsa',
                roomId: session.roomId,
                people: new Map(),
            });
        }

        const rooms = await this.prisma.room.findMany({ where: { id: { in: [...roomIds] } }, select: { id: true, name: true } });
        const roomName = new Map(rooms.map((r) => [r.id, r.name]));
        const describe = (item: Item) => `${item.who} (${item.what}, ${item.startTime}–${item.endTime})`;

        const conflicts: ScheduleConflict[] = [];
        const byDate = new Map<string, Item[]>();
        items.forEach((item) => byDate.set(item.date, [...(byDate.get(item.date) ?? []), item]));

        for (const [date, dayItems] of byDate) {
            dayItems.sort((a, b) => a.start - b.start);
            for (let i = 0; i < dayItems.length; i++) {
                for (let j = i + 1; j < dayItems.length; j++) {
                    const a = dayItems[i];
                    const b = dayItems[j];
                    if (b.start >= a.end) break; // ordenado por início: daqui pra frente ninguém mais sobrepõe `a`
                    if (a.courseId !== courseId && b.courseId !== courseId) continue;

                    if (a.roomId && a.roomId === b.roomId) {
                        conflicts.push({ type: 'ROOM', date, message: `${roomName.get(a.roomId) ?? 'Sala'} ocupada duas vezes: ${describe(a)} e ${describe(b)}.`, blockIds: [a.id, b.id] });
                    }
                    for (const [userId, name] of a.people) {
                        if (b.people.has(userId)) {
                            conflicts.push({ type: 'PERSON', date, message: `${name} está em dois lugares: ${describe(a)} e ${describe(b)}.`, blockIds: [a.id, b.id] });
                        }
                    }
                }
            }
        }
        return conflicts.slice(0, 200);
    }

    // ───────────────────────────── grupos ─────────────────────────────

    async createGroup(courseId: string, organizationId: string, dto: CreateGroupDto) {
        await this.requireCourse(courseId, organizationId);
        await this.roomsService.assertUsable(dto.roomId, organizationId);
        const order = await this.prisma.courseGroup.count({ where: { courseId } });
        try {
            return await this.prisma.courseGroup.create({ data: { courseId, name: dto.name.trim(), roomId: dto.roomId || null, order }, include: GROUP_INCLUDE });
        } catch (error) {
            throw this.translateGroupUniqueError(error, dto.name);
        }
    }

    async updateGroup(courseId: string, organizationId: string, groupId: string, dto: UpdateGroupDto) {
        const course = await this.requireCourse(courseId, organizationId);
        const group = await this.requireGroup(courseId, groupId);
        await this.roomsService.assertUsable(dto.roomId, organizationId, group.roomId);

        try {
            return await this.prisma.$transaction(async (tx) => {
                const updated = await tx.courseGroup.update({
                    where: { id: groupId },
                    data: { name: dto.name?.trim(), roomId: dto.roomId === undefined ? undefined : dto.roomId || null },
                    include: GROUP_INCLUDE,
                });
                // Os períodos de chamada gerados pela programação ficam na sala base do grupo.
                if (dto.roomId !== undefined) {
                    await tx.classSession.updateMany({ where: { groupId, fromSchedule: true }, data: { roomId: updated.roomId ?? course.defaultRoomId } });
                }
                return updated;
            });
        } catch (error) {
            throw this.translateGroupUniqueError(error, dto.name);
        }
    }

    async removeGroup(courseId: string, organizationId: string, groupId: string) {
        await this.requireCourse(courseId, organizationId);
        await this.requireGroup(courseId, groupId);
        const recorded = await this.prisma.attendance.count({ where: { classSession: { groupId } } });
        if (recorded > 0) {
            throw new ConflictException('Este grupo já tem chamada lançada. Excluir apagaria as presenças dos alunos.');
        }
        // Aulas e programação do grupo vão junto (cascade); os alunos ficam sem grupo.
        await this.prisma.courseGroup.delete({ where: { id: groupId } });
        return { id: groupId };
    }

    async assignGroups(courseId: string, organizationId: string, dto: AssignGroupsDto) {
        await this.requireCourse(courseId, organizationId);
        const enrollmentIds = [...new Set(dto.assignments.map((a) => a.enrollmentId))];
        const groupIds = [...new Set(dto.assignments.map((a) => a.groupId).filter((id): id is string => Boolean(id)))];

        const [enrollmentCount, groupCount] = await Promise.all([
            this.prisma.enrollment.count({ where: { id: { in: enrollmentIds }, courseId } }),
            this.prisma.courseGroup.count({ where: { id: { in: groupIds }, courseId } }),
        ]);
        if (enrollmentCount !== enrollmentIds.length || groupCount !== groupIds.length) {
            throw new BadRequestException('Há matrículas ou grupos que não são desta turma.');
        }

        await this.prisma.$transaction(
            dto.assignments.map((a) => this.prisma.enrollment.update({ where: { id: a.enrollmentId }, data: { groupId: a.groupId || null } })),
        );
        return { updated: dto.assignments.length };
    }

    // ───────────────────────────── atividades ─────────────────────────────

    async createActivity(courseId: string, organizationId: string, dto: CreateActivityDto) {
        await this.requireCourse(courseId, organizationId);
        await this.roomsService.assertUsable(dto.roomId, organizationId);
        const assignees = await this.resolveAssignees(dto.assignees ?? [], organizationId);
        const order = await this.prisma.courseActivity.count({ where: { courseId } });

        return this.prisma.$transaction(async (tx) => {
            const activity = await tx.courseActivity.create({
                data: {
                    courseId,
                    title: dto.title.trim(),
                    kind: dto.kind ?? ScheduleActivityKind.ACTIVITY,
                    durationMinutes: dto.durationMinutes,
                    roomId: dto.roomId || null,
                    order,
                    assignees: { create: assignees.rows },
                },
                include: ACTIVITY_INCLUDE,
            });
            await this.ensureCourseInstructors(tx, courseId, assignees.userIds);
            return activity;
        });
    }

    async updateActivity(courseId: string, organizationId: string, activityId: string, dto: UpdateActivityDto) {
        const course = await this.requireCourse(courseId, organizationId);
        const activity = await this.requireActivity(courseId, activityId);
        await this.roomsService.assertUsable(dto.roomId, organizationId, activity.roomId);
        const assignees = dto.assignees === undefined ? undefined : await this.resolveAssignees(dto.assignees, organizationId);
        // Duração muda os horários de todos os dias em que a atividade aparece; tipo muda onde
        // ficam as refeições (que dividem os períodos de chamada).
        const reflow =
            (dto.durationMinutes !== undefined && dto.durationMinutes !== activity.durationMinutes) || (dto.kind !== undefined && dto.kind !== activity.kind);

        return this.prisma.$transaction(async (tx) => {
            const updated = await tx.courseActivity.update({
                where: { id: activityId },
                data: {
                    title: dto.title?.trim(),
                    kind: dto.kind,
                    durationMinutes: dto.durationMinutes,
                    roomId: dto.roomId === undefined ? undefined : dto.roomId || null,
                    ...(assignees && { assignees: { deleteMany: {}, create: assignees.rows } }),
                },
                include: ACTIVITY_INCLUDE,
            });
            if (assignees) await this.ensureCourseInstructors(tx, courseId, assignees.userIds);
            if (reflow) {
                for (const day of await this.daysUsingActivity(tx, activityId)) {
                    await this.reflowDay(tx, course, day.groupId, day.date);
                }
            }
            return updated;
        }, LONG_TRANSACTION);
    }

    async removeActivity(courseId: string, organizationId: string, activityId: string) {
        const course = await this.requireCourse(courseId, organizationId);
        await this.requireActivity(courseId, activityId);

        await this.prisma.$transaction(async (tx) => {
            const days = await this.daysUsingActivity(tx, activityId);
            await tx.courseActivity.delete({ where: { id: activityId } }); // blocos vão junto (cascade)
            for (const day of days) {
                await this.reflowDay(tx, course, day.groupId, day.date);
            }
        }, LONG_TRANSACTION);
        return { id: activityId };
    }

    // ───────────────────────────── dia de um grupo ─────────────────────────────

    async saveDay(courseId: string, organizationId: string, dto: SaveScheduleDayDto) {
        const course = await this.requireCourse(courseId, organizationId);
        const groupId = dto.groupId || null;
        if (groupId) await this.requireGroup(courseId, groupId);
        const date = toDateOnly(dto.date);

        const activities = await this.prisma.courseActivity.findMany({ where: { id: { in: [...new Set(dto.activityIds)] }, courseId } });
        const byId = new Map(activities.map((a) => [a.id, a]));
        if (dto.activityIds.some((id) => !byId.has(id))) {
            throw new BadRequestException('Há atividades que não são desta turma.');
        }
        const times = this.computeTimes(dto.startTime, dto.activityIds.map((id) => byId.get(id)!.durationMinutes));

        await this.prisma.$transaction(async (tx) => {
            await tx.scheduleBlock.deleteMany({ where: { courseId, groupId, date } });
            await tx.scheduleBlock.createMany({
                data: dto.activityIds.map((activityId, order) => ({ courseId, groupId, date, order, activityId, startTime: times[order].start, endTime: times[order].end })),
            });
            await this.syncPeriodSessions(tx, course, groupId, date);
        }, LONG_TRANSACTION);
    }

    /** Horário de cada bloco = início do dia + soma das durações anteriores. */
    private computeTimes(startTime: string, durations: number[]) {
        let cursor = toMinutes(startTime);
        return durations.map((duration) => {
            const start = cursor;
            cursor += duration;
            if (cursor > 23 * 60 + 59) {
                throw new BadRequestException('A programação passaria da meia-noite. Comece mais cedo ou tire atividades.');
            }
            return { start: fromMinutes(start), end: fromMinutes(cursor) };
        });
    }

    /** Recalcula os horários de um dia já montado (depois de mudar a duração/tipo de uma atividade). */
    private async reflowDay(tx: Tx, course: CourseRef, groupId: string | null, date: Date) {
        const blocks = await tx.scheduleBlock.findMany({ where: { courseId: course.id, groupId, date }, include: { activity: true }, orderBy: { order: 'asc' } });
        if (blocks.length > 0) {
            const times = this.computeTimes(blocks[0].startTime, blocks.map((b) => b.activity.durationMinutes));
            for (const [index, block] of blocks.entries()) {
                await tx.scheduleBlock.update({ where: { id: block.id }, data: { order: index, startTime: times[index].start, endTime: times[index].end } });
            }
        }
        await this.syncPeriodSessions(tx, course, groupId, date);
    }

    /**
     * Mantém uma ClassSession por período (trecho entre refeições) do dia. Casa os períodos já
     * existentes pela ordem, para preservar a chamada lançada; um período que deixaria de existir
     * mas tem chamada impede a mudança.
     */
    private async syncPeriodSessions(tx: Tx, course: CourseRef, groupId: string | null, date: Date) {
        const blocks = await tx.scheduleBlock.findMany({ where: { courseId: course.id, groupId, date }, include: { activity: true }, orderBy: { order: 'asc' } });

        // Cada refeição fecha o período em andamento; o próximo bloco abre outro.
        const periods: { startTime: string; endTime: string }[] = [];
        let periodOpen = false;
        for (const block of blocks) {
            if (block.activity.kind === ScheduleActivityKind.MEAL) {
                periodOpen = false;
            } else if (periodOpen) {
                periods[periods.length - 1].endTime = block.endTime;
            } else {
                periods.push({ startTime: block.startTime, endTime: block.endTime });
                periodOpen = true;
            }
        }

        const group = groupId ? await tx.courseGroup.findUnique({ where: { id: groupId }, select: { roomId: true } }) : null;
        const roomId = group?.roomId ?? course.defaultRoomId;
        const existing = await tx.classSession.findMany({
            where: { courseId: course.id, groupId, date, fromSchedule: true },
            include: { _count: { select: { attendances: true } } },
            orderBy: { startTime: 'asc' },
        });

        const labels = periods.map((p) => periodLabel(p.startTime));
        for (const [index, period] of periods.entries()) {
            // Dois períodos com o mesmo rótulo (ex.: dois trechos de manhã) ganham número.
            const topic = labels.filter((l) => l === labels[index]).length > 1 ? `${labels[index]} (${index + 1})` : labels[index];
            const data = { startTime: period.startTime, endTime: period.endTime, topic, roomId };
            if (existing[index]) {
                await tx.classSession.update({ where: { id: existing[index].id }, data });
            } else {
                await tx.classSession.create({ data: { ...data, courseId: course.id, groupId, date, fromSchedule: true } });
            }
        }

        for (const extra of existing.slice(periods.length)) {
            if (extra._count.attendances > 0) {
                throw new ConflictException(
                    `O período ${extra.topic ?? ''} (${extra.startTime}–${extra.endTime}) já tem chamada lançada e deixaria de existir com essa mudança.`,
                );
            }
            await tx.classSession.delete({ where: { id: extra.id } });
        }
    }

    private daysUsingActivity(tx: Tx, activityId: string) {
        return tx.scheduleBlock.findMany({ where: { activityId }, select: { groupId: true, date: true }, distinct: ['groupId', 'date'] });
    }

    // ───────────────────────────── modelos ─────────────────────────────

    async saveTemplate(courseId: string, organizationId: string, name: string) {
        await this.requireCourse(courseId, organizationId);
        const [groups, activities, blocks] = await Promise.all([
            this.prisma.courseGroup.findMany({ where: { courseId }, orderBy: [{ order: 'asc' }, { createdAt: 'asc' }] }),
            this.prisma.courseActivity.findMany({ where: { courseId }, include: { assignees: true }, orderBy: [{ order: 'asc' }, { createdAt: 'asc' }] }),
            this.prisma.scheduleBlock.findMany({ where: { courseId }, orderBy: [{ date: 'asc' }, { order: 'asc' }] }),
        ]);
        if (activities.length === 0) {
            throw new BadRequestException('Cadastre as atividades da turma antes de salvar um modelo.');
        }

        const firstDay = blocks[0]?.date.getTime() ?? 0;
        const days = new Map<string, TemplateData['days'][number]>();
        for (const block of blocks) {
            const key = `${block.groupId ?? ''}|${dateKey(block.date)}`;
            const day = days.get(key) ?? { dayOffset: Math.round((block.date.getTime() - firstDay) / DAY_MS), groupKey: block.groupId, startTime: block.startTime, activityKeys: [] };
            day.activityKeys.push(block.activityId);
            days.set(key, day);
        }

        const data: TemplateData = {
            version: 1,
            groups: groups.map((g) => ({ key: g.id, name: g.name, roomId: g.roomId })),
            activities: activities.map((a) => ({
                key: a.id,
                title: a.title,
                kind: a.kind,
                durationMinutes: a.durationMinutes,
                roomId: a.roomId,
                assignees: a.assignees.map((x) => ({ teamId: x.teamId, userId: x.userId })),
            })),
            days: [...days.values()],
        };

        const template = await this.prisma.scheduleTemplate.upsert({
            where: { organizationId_name: { organizationId, name: name.trim() } },
            create: { organizationId, name: name.trim(), data: data as unknown as Prisma.InputJsonValue },
            update: { data: data as unknown as Prisma.InputJsonValue },
        });
        return this.summarizeTemplate(template);
    }

    async listTemplates(organizationId: string) {
        const templates = await this.prisma.scheduleTemplate.findMany({ where: { organizationId }, orderBy: { name: 'asc' } });
        return templates.map((t) => this.summarizeTemplate(t));
    }

    async removeTemplate(id: string, organizationId: string) {
        const template = await this.prisma.scheduleTemplate.findFirst({ where: { id, organizationId } });
        if (!template) throw new NotFoundException('Modelo não encontrado.');
        await this.prisma.scheduleTemplate.delete({ where: { id } });
        return { id };
    }

    /**
     * Cria grupos (reaproveita os que já existem com o mesmo nome), atividades e a programação de
     * cada dia a partir de `startDate`. Só em turma sem atividades, para não misturar duas
     * programações. Sala/equipe/pessoa do modelo que não existe mais (ou foi desativada) é deixada de fora.
     */
    async applyTemplate(courseId: string, organizationId: string, dto: ApplyTemplateDto) {
        const course = await this.requireCourse(courseId, organizationId);
        if ((await this.prisma.courseActivity.count({ where: { courseId } })) > 0) {
            throw new ConflictException('Esta turma já tem atividades cadastradas. O modelo só pode ser aplicado numa programação vazia.');
        }
        const template = await this.prisma.scheduleTemplate.findFirst({ where: { id: dto.templateId, organizationId } });
        if (!template) throw new NotFoundException('Modelo não encontrado.');
        const data = template.data as unknown as TemplateData;

        const referencedRooms = [...data.groups.map((g) => g.roomId), ...data.activities.map((a) => a.roomId)].filter((id): id is string => Boolean(id));
        const referencedTeams = data.activities.flatMap((a) => a.assignees.map((x) => x.teamId)).filter((id): id is string => Boolean(id));
        const referencedUsers = data.activities.flatMap((a) => a.assignees.map((x) => x.userId)).filter((id): id is string => Boolean(id));
        const [rooms, teams, users] = await Promise.all([
            this.prisma.room.findMany({ where: { id: { in: referencedRooms }, organizationId, active: true }, select: { id: true } }),
            this.prisma.instructorTeam.findMany({ where: { id: { in: referencedTeams }, organizationId, active: true }, include: { members: true } }),
            this.prisma.user.findMany({ where: { id: { in: referencedUsers }, organizationId }, select: { id: true } }),
        ]);
        const validRooms = new Set(rooms.map((r) => r.id));
        const teamsById = new Map(teams.map((t) => [t.id, t]));
        const validUsers = new Set(users.map((u) => u.id));
        const startDate = toDateOnly(dto.startDate);

        await this.prisma.$transaction(async (tx) => {
            const existingGroups = await tx.courseGroup.findMany({ where: { courseId } });
            const groupIdByKey = new Map<string, string>();
            for (const [order, g] of data.groups.entries()) {
                const existing = existingGroups.find((e) => e.name === g.name);
                const created =
                    existing ?? (await tx.courseGroup.create({ data: { courseId, name: g.name, roomId: g.roomId && validRooms.has(g.roomId) ? g.roomId : null, order } }));
                groupIdByKey.set(g.key, created.id);
            }

            const activityByKey = new Map<string, { id: string; durationMinutes: number }>();
            const instructorIds = new Set<string>();
            for (const [order, a] of data.activities.entries()) {
                const assignees = a.assignees.filter((x) => (x.teamId && teamsById.has(x.teamId)) || (x.userId && validUsers.has(x.userId)));
                assignees.forEach((x) => {
                    if (x.userId) instructorIds.add(x.userId);
                    if (x.teamId) teamsById.get(x.teamId)!.members.forEach((m) => instructorIds.add(m.userId));
                });
                const created = await tx.courseActivity.create({
                    data: {
                        courseId,
                        title: a.title,
                        kind: a.kind,
                        durationMinutes: a.durationMinutes,
                        roomId: a.roomId && validRooms.has(a.roomId) ? a.roomId : null,
                        order,
                        assignees: { create: assignees.map((x) => (x.teamId ? { teamId: x.teamId } : { userId: x.userId! })) },
                    },
                });
                activityByKey.set(a.key, created);
            }
            await this.ensureCourseInstructors(tx, courseId, [...instructorIds]);

            for (const day of data.days) {
                const groupId = day.groupKey ? (groupIdByKey.get(day.groupKey) ?? null) : null;
                const date = new Date(startDate.getTime() + day.dayOffset * DAY_MS);
                const dayActivities = day.activityKeys.map((key) => activityByKey.get(key)).filter((a): a is { id: string; durationMinutes: number } => Boolean(a));
                const times = this.computeTimes(day.startTime, dayActivities.map((a) => a.durationMinutes));
                await tx.scheduleBlock.deleteMany({ where: { courseId, groupId, date } });
                await tx.scheduleBlock.createMany({
                    data: dayActivities.map((a, order) => ({ courseId, groupId, date, order, activityId: a.id, startTime: times[order].start, endTime: times[order].end })),
                });
                await this.syncPeriodSessions(tx, course, groupId, date);
            }
        }, LONG_TRANSACTION);
    }

    private summarizeTemplate(template: { id: string; name: string; updatedAt: Date; data: Prisma.JsonValue }) {
        const data = template.data as unknown as TemplateData;
        return {
            id: template.id,
            name: template.name,
            updatedAt: template.updatedAt,
            groups: data.groups.length,
            activities: data.activities.length,
            days: new Set(data.days.map((d) => d.dayOffset)).size,
        };
    }

    // ───────────────────────────── apoio ─────────────────────────────

    private async requireCourse(courseId: string, organizationId: string): Promise<CourseRef> {
        const course = await this.prisma.course.findFirst({ where: { id: courseId, organizationId }, select: { id: true, organizationId: true, defaultRoomId: true } });
        if (!course) {
            throw new NotFoundException(`Turma com ID ${courseId} não encontrada nesta organização.`);
        }
        return course;
    }

    private async requireGroup(courseId: string, groupId: string) {
        const group = await this.prisma.courseGroup.findFirst({ where: { id: groupId, courseId } });
        if (!group) throw new NotFoundException('Grupo não encontrado nesta turma.');
        return group;
    }

    private async requireActivity(courseId: string, activityId: string) {
        const activity = await this.prisma.courseActivity.findFirst({ where: { id: activityId, courseId } });
        if (!activity) throw new NotFoundException('Atividade não encontrada nesta turma.');
        return activity;
    }

    /** Valida equipes/pessoas e devolve as linhas a criar + todas as pessoas envolvidas (membros das equipes incluídos). */
    private async resolveAssignees(assignees: ActivityAssigneeDto[], organizationId: string) {
        if (assignees.some((a) => Boolean(a.teamId) === Boolean(a.userId))) {
            throw new BadRequestException('Cada responsável deve ser uma equipe ou uma pessoa.');
        }
        const teamIds = [...new Set(assignees.map((a) => a.teamId).filter((id): id is string => Boolean(id)))];
        const userIds = [...new Set(assignees.map((a) => a.userId).filter((id): id is string => Boolean(id)))];

        const [teams, userCount] = await Promise.all([
            this.prisma.instructorTeam.findMany({ where: { id: { in: teamIds }, organizationId }, include: { members: true } }),
            this.prisma.user.count({ where: { id: { in: userIds }, organizationId } }),
        ]);
        if (teams.length !== teamIds.length || userCount !== userIds.length) {
            throw new BadRequestException('Há equipes ou pessoas que não pertencem a esta organização.');
        }

        return {
            rows: [...teamIds.map((teamId) => ({ teamId })), ...userIds.map((userId) => ({ userId }))],
            userIds: [...new Set([...userIds, ...teams.flatMap((t) => t.members.map((m) => m.userId))])],
        };
    }

    private async ensureCourseInstructors(tx: Tx, courseId: string, userIds: string[]) {
        if (userIds.length === 0) return;
        await tx.courseInstructor.createMany({ data: userIds.map((userId) => ({ courseId, userId })), skipDuplicates: true });
    }

    private translateGroupUniqueError(error: unknown, name?: string) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            return new ConflictException(`Já existe um grupo chamado "${name?.trim()}" nesta turma.`);
        }
        return error;
    }
}
