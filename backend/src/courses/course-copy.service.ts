// backend/src/courses/course-copy.service.ts
//
// Copiar o conteúdo de uma turma para outra (decisão 77 do docs/decisoes.md): quando a academia
// repete um treinamento, agenda, programação e vídeo-aulas não precisam ser refeitos do zero.
// Só estrutura é copiada — alunos, matrículas, chamadas, diários, progresso e certificados ficam
// de fora, assim como a escala de professores por aula/módulo (a turma nova costuma ter outra equipe).
//
// As datas são deslocadas pela mesma distância: o primeiro dia copiado (aula avulsa ou programação,
// o que vier antes) passa a ser `startDate`, e o resto mantém o intervalo entre os dias.
//
// Arquivos enviados ao storage (vídeos e materiais) NÃO são duplicados: as duas turmas apontam
// para o mesmo objeto. Por isso a exclusão definitiva da lixeira só apaga um arquivo quando
// nenhuma outra aula o usa (ver trash.service.ts).

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CourseScheduleService } from './course-schedule.service';
import { CopyCourseContentDto } from './dto/copy-course.dto';

type Tx = Prisma.TransactionClient;

const LONG_TRANSACTION = { timeout: 30_000, maxWait: 10_000 };

const toDateOnly = (value: string | Date) => new Date(`${(typeof value === 'string' ? value : value.toISOString()).slice(0, 10)}T00:00:00.000Z`);
const formatDate = (date: Date) => date.toISOString().slice(0, 10).split('-').reverse().join('/');

export interface CopyPreview {
    source: {
        title: string;
        sessions: number;
        groups: number;
        activities: number;
        scheduleDays: number;
        modules: number;
        lessons: number;
        videos: number;
        files: number;
        /** Primeiro dia com algo datado (aula avulsa ou programação), `YYYY-MM-DD`. */
        firstDate: string | null;
    };
    /** O que a turma de destino já tem — o que for copiado entra junto, não substitui. */
    target: { sessions: number; activities: number; modules: number };
}

export interface CopyResult {
    sessions: { copied: number; skipped: number };
    schedule: { groups: number; activities: number; days: number };
    lessons: { modules: number; lessons: number };
    /** Avisos para a pessoa conferir (aula sem sala, aula de grupo que não existe na turma nova...). */
    warnings: string[];
}

@Injectable()
export class CourseCopyService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly scheduleService: CourseScheduleService,
    ) {}

    private async requireCourse(courseId: string, organizationId: string) {
        const course = await this.prisma.course.findFirst({ where: { id: courseId, organizationId }, include: { event: { select: { title: true } } } });
        if (!course) {
            throw new NotFoundException(`Turma com ID ${courseId} não encontrada nesta organização.`);
        }
        return course;
    }

    private async requirePair(targetId: string, sourceId: string, organizationId: string) {
        if (targetId === sourceId) {
            throw new BadRequestException('Escolha outra turma: não dá para copiar uma turma para ela mesma.');
        }
        const [target, source] = await Promise.all([this.requireCourse(targetId, organizationId), this.requireCourse(sourceId, organizationId)]);
        return { target, source };
    }

    async preview(targetId: string, sourceId: string, organizationId: string): Promise<CopyPreview> {
        const { target, source } = await this.requirePair(targetId, sourceId, organizationId);
        const lessonsOf = { module: { courseId: sourceId } };
        const [sessions, groups, activities, days, modules, lessons, videos, files, firstSession, firstBlock, tSessions, tActivities, tModules] = await Promise.all([
            this.prisma.classSession.count({ where: { courseId: sourceId, fromSchedule: false } }),
            this.prisma.courseGroup.count({ where: { courseId: sourceId } }),
            this.prisma.courseActivity.count({ where: { courseId: sourceId } }),
            this.prisma.scheduleBlock.findMany({ where: { courseId: sourceId }, select: { groupId: true, date: true }, distinct: ['groupId', 'date'] }),
            this.prisma.courseModule.count({ where: { courseId: sourceId } }),
            this.prisma.courseLesson.count({ where: lessonsOf }),
            this.prisma.courseLessonVideo.count({ where: { lesson: lessonsOf } }),
            this.prisma.courseLessonFile.count({ where: { lesson: lessonsOf } }),
            this.prisma.classSession.findFirst({ where: { courseId: sourceId, fromSchedule: false }, orderBy: { date: 'asc' }, select: { date: true } }),
            this.prisma.scheduleBlock.findFirst({ where: { courseId: sourceId }, orderBy: { date: 'asc' }, select: { date: true } }),
            this.prisma.classSession.count({ where: { courseId: targetId, fromSchedule: false } }),
            this.prisma.courseActivity.count({ where: { courseId: targetId } }),
            this.prisma.courseModule.count({ where: { courseId: targetId } }),
        ]);

        const dates = [firstSession?.date, firstBlock?.date].filter((d): d is Date => Boolean(d));
        const firstDate = dates.length ? new Date(Math.min(...dates.map((d) => d.getTime()))) : null;
        return {
            source: {
                title: source.event.title,
                sessions,
                groups,
                activities,
                scheduleDays: days.length,
                modules,
                lessons,
                videos,
                files,
                firstDate: firstDate ? firstDate.toISOString().slice(0, 10) : null,
            },
            target: { sessions: tSessions, activities: tActivities, modules: tModules },
        };
    }

    async copy(targetId: string, organizationId: string, dto: CopyCourseContentDto, userId: string): Promise<CopyResult> {
        if (!dto.sessions && !dto.schedule && !dto.lessons) {
            throw new BadRequestException('Escolha o que copiar: agenda, programação ou vídeo-aulas.');
        }
        const { target, source } = await this.requirePair(targetId, dto.sourceCourseId, organizationId);
        const preview = await this.preview(targetId, source.id, organizationId);

        // A primeira data só conta para o que foi escolhido: copiar só as vídeo-aulas não precisa de data.
        const [firstSession, firstBlock] = await Promise.all([
            dto.sessions ? this.prisma.classSession.findFirst({ where: { courseId: source.id, fromSchedule: false }, orderBy: { date: 'asc' }, select: { date: true } }) : null,
            dto.schedule ? this.prisma.scheduleBlock.findFirst({ where: { courseId: source.id }, orderBy: { date: 'asc' }, select: { date: true } }) : null,
        ]);
        const dated = [firstSession?.date, firstBlock?.date].filter((d): d is Date => Boolean(d));
        let shiftMs = 0;
        if (dated.length > 0) {
            if (!dto.startDate) {
                throw new BadRequestException('Informe o primeiro dia da turma nova.');
            }
            shiftMs = toDateOnly(dto.startDate).getTime() - Math.min(...dated.map((d) => d.getTime()));
        }
        const shift = (date: Date) => new Date(date.getTime() + shiftMs);

        const result: CopyResult = {
            sessions: { copied: 0, skipped: 0 },
            schedule: { groups: 0, activities: 0, days: 0 },
            lessons: { modules: 0, lessons: 0 },
            warnings: [],
        };

        // Programação primeiro: ela cria os grupos que as aulas avulsas usam, e é a única parte que
        // pode recusar (turma de destino já com atividades) — assim a recusa vem antes de qualquer gravação.
        if (dto.schedule && preview.source.activities > 0) {
            const { data, firstDate } = await this.scheduleService.buildTemplateData(source.id);
            await this.scheduleService.applyTemplateData(target.id, organizationId, data, shift(firstDate ?? new Date(dated[0] ?? Date.now())));
            result.schedule = { groups: data.groups.length, activities: data.activities.length, days: preview.source.scheduleDays };
        }

        await this.prisma.$transaction(async (tx) => {
            if (dto.sessions) {
                await this.copySessions(tx, source.id, target.id, organizationId, shift, result);
            }
            if (dto.lessons) {
                await this.copyLessons(tx, source.id, target.id, userId, result);
            }
        }, LONG_TRANSACTION);

        return result;
    }

    private async copySessions(tx: Tx, sourceId: string, targetId: string, organizationId: string, shift: (date: Date) => Date, result: CopyResult) {
        const sessions = await tx.classSession.findMany({
            where: { courseId: sourceId, fromSchedule: false },
            orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
            include: { group: { select: { name: true } } },
        });
        if (sessions.length === 0) return;

        const [groups, rooms] = await Promise.all([
            tx.courseGroup.findMany({ where: { courseId: targetId }, select: { id: true, name: true } }),
            tx.room.findMany({ where: { organizationId, active: true }, select: { id: true } }),
        ]);
        const groupIdByName = new Map(groups.map((g) => [g.name, g.id]));
        const activeRooms = new Set(rooms.map((r) => r.id));

        for (const session of sessions) {
            const date = shift(session.date);
            const label = `${formatDate(date)} ${session.startTime}${session.topic ? ` (${session.topic})` : ''}`;

            let groupId: string | null = null;
            if (session.group) {
                groupId = groupIdByName.get(session.group.name) ?? null;
                if (!groupId) {
                    result.sessions.skipped++;
                    result.warnings.push(`Aula de ${label} não foi copiada: era do grupo "${session.group.name}", que não existe na turma nova.`);
                    continue;
                }
            }

            // Sala desativada ou já ocupada na nova data: a aula é copiada sem sala em vez de quebrar a regra de uma sala por horário.
            let roomId = session.roomId;
            if (roomId && !activeRooms.has(roomId)) {
                roomId = null;
                result.warnings.push(`Aula de ${label} foi copiada sem sala: a sala original está desativada.`);
            } else if (roomId) {
                const clash = await tx.classSession.findFirst({
                    where: { roomId, date, startTime: { lt: session.endTime }, endTime: { gt: session.startTime }, course: { deletedAt: null } },
                    include: { room: { select: { name: true } } },
                });
                if (clash) {
                    result.warnings.push(`Aula de ${label} foi copiada sem sala: "${clash.room?.name}" já está ocupada nesse horário.`);
                    roomId = null;
                }
            }

            await tx.classSession.create({
                data: { courseId: targetId, date, startTime: session.startTime, endTime: session.endTime, roomId, groupId, topic: session.topic },
            });
            result.sessions.copied++;
        }
    }

    private async copyLessons(tx: Tx, sourceId: string, targetId: string, userId: string, result: CopyResult) {
        const modules = await tx.courseModule.findMany({
            where: { courseId: sourceId },
            orderBy: [{ order: 'asc' }, { id: 'asc' }],
            include: {
                lessons: {
                    orderBy: [{ order: 'asc' }, { id: 'asc' }],
                    include: { videos: { orderBy: { order: 'asc' } }, files: { orderBy: { createdAt: 'asc' } } },
                },
            },
        });
        // O que já existe na turma nova fica onde está: o copiado entra depois.
        const last = await tx.courseModule.aggregate({ where: { courseId: targetId }, _max: { order: true } });
        const firstOrder = (last._max.order ?? -1) + 1;

        for (const [index, courseModule] of modules.entries()) {
            await tx.courseModule.create({
                data: {
                    courseId: targetId,
                    title: courseModule.title,
                    order: firstOrder + index,
                    active: courseModule.active,
                    lessons: {
                        create: courseModule.lessons.map((lesson) => ({
                            title: lesson.title,
                            content: lesson.content,
                            duration: lesson.duration,
                            order: lesson.order,
                            active: lesson.active,
                            videos: { create: lesson.videos.map((v) => ({ title: v.title, url: v.url, storageKey: v.storageKey, order: v.order })) },
                            files: {
                                create: lesson.files.map((f) => ({
                                    name: f.name,
                                    storageKey: f.storageKey,
                                    externalUrl: f.externalUrl,
                                    mimeType: f.mimeType,
                                    size: f.size,
                                    uploadedByUserId: userId,
                                })),
                            },
                        })),
                    },
                },
            });
            result.lessons.modules++;
            result.lessons.lessons += courseModule.lessons.length;
        }
    }
}
