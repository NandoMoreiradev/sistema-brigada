// backend/src/events/events.service.ts
//
// CRUD do tronco polimórfico `Event` para os kinds que não são TURMA
// (decisão 2 do docs/decisoes.md — TURMA é exclusividade do módulo `courses`,
// que precisa criar Event+Course juntos). Ao criar um evento REUNIAO, tenta
// gerar automaticamente um link do Google Meet via `GoogleCalendarService`
// (usa a integração OAuth do usuário que está criando o evento) — se ele não
// tiver conectado o Google, o evento é criado normalmente sem `meetUrl`
// (preenchível depois à mão).
//
// Reagendar/excluir uma REUNIAO que já tem `googleEventId` propaga para o
// Google Calendar do criador (update()/remove() abaixo) — sem isso o convite
// no Google ficava com a data antiga depois de um reagendamento pela UI.
// Como no create(), qualquer falha aqui é só logada (GoogleCalendarService
// nunca propaga erro) — o evento local é sempre a fonte da verdade.

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, EventKind } from '@prisma/client';
import { GoogleCalendarService } from '../user-integrations/google-calendar/google-calendar.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { ListEventsDto } from './dto/list-events.dto';
import { parseAppDateTime } from '../common/datetime';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { userHasPermission } from '../auth/common/user-has-permission.util';

const OPERATION_KINDS: EventKind[] = [EventKind.ASSEMBLEIA, EventKind.CONGRESSO, EventKind.ATUACAO_BRIGADA];

const eventInclude = {
    operation: {
        include: {
            _count: { select: { designations: true, occurrenceReports: true } },
            posts: { orderBy: { createdAt: 'asc' } },
        },
    },
    meeting: { include: { _count: { select: { attendances: true } } } },
    _count: { select: { files: true } },
} satisfies Prisma.EventInclude;

@Injectable()
export class EventsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly googleCalendarService: GoogleCalendarService,
    ) {}

    async create(dto: CreateEventDto, organizationId: string, createdByUserId: string) {
        const startDate = parseAppDateTime(dto.startDate);
        const endDate = parseAppDateTime(dto.endDate);
        if (endDate && endDate <= startDate) {
            throw new BadRequestException('A data/hora de término deve ser depois da data/hora de início.');
        }

        let meetUrl: string | null = null;
        let googleEventId: string | null = null;
        if (dto.kind === EventKind.REUNIAO) {
            const calendarEvent = await this.googleCalendarService.createEvent(createdByUserId, {
                summary: dto.title,
                description: dto.agenda,
                location: dto.location,
                start: startDate,
                end: endDate ?? new Date(startDate.getTime() + 60 * 60 * 1000),
            });
            meetUrl = calendarEvent?.meetUrl ?? null;
            googleEventId = calendarEvent?.eventId ?? null;
        }

        return this.prisma.$transaction(async (tx) => {
            const event = await tx.event.create({
                data: {
                    organizationId,
                    kind: dto.kind,
                    title: dto.title,
                    location: dto.location,
                    startDate,
                    endDate,
                    createdByUserId,
                },
            });

            if (OPERATION_KINDS.includes(dto.kind)) {
                await tx.eventOperation.create({
                    data: { eventId: event.id, estimatedAudienceCount: dto.estimatedAudienceCount, notes: dto.notes },
                });
            } else if (dto.kind === EventKind.REUNIAO) {
                await tx.meeting.create({
                    data: { eventId: event.id, agenda: dto.agenda, meetUrl, googleEventId },
                });
            }

            return tx.event.findUniqueOrThrow({ where: { id: event.id }, include: eventInclude });
        });
    }

    /**
     * Visibilidade de evento pra quem não administra eventos (`events:manage`):
     * reunião é aberta a todo mundo da organização (presença não depende de
     * escala prévia); assembleia/congresso/atuação de brigada só aparecem pra
     * quem tem designação nela — quem só é aluno normalmente não é StaffMember
     * e não vê nenhum desses três.
     */
    private visibilityFilter(user: AuthenticatedUser): Prisma.EventWhereInput | undefined {
        if (userHasPermission(user, 'events:manage')) return undefined;
        return {
            OR: [
                { kind: EventKind.REUNIAO },
                { operation: { designations: { some: { staffMember: { userId: user.id } } } } },
            ],
        };
    }

    private async canViewEvent(
        event: { kind: EventKind; operation: { id: string } | null },
        user: AuthenticatedUser,
    ): Promise<boolean> {
        if (userHasPermission(user, 'events:manage')) return true;
        if (event.kind === EventKind.REUNIAO) return true;
        if (!event.operation) return false;

        const designation = await this.prisma.designation.findFirst({
            where: { eventOperationId: event.operation.id, staffMember: { userId: user.id } },
            select: { id: true },
        });
        return Boolean(designation);
    }

    async findAll(organizationId: string, query: ListEventsDto, user: AuthenticatedUser) {
        const { kind, search, page = 1, limit = 20 } = query;

        const where: Prisma.EventWhereInput = {
            organizationId,
            kind: kind ? kind : { in: OPERATION_KINDS.concat(EventKind.REUNIAO) },
        };
        if (search) {
            where.title = { contains: search, mode: 'insensitive' };
        }

        const visibility = this.visibilityFilter(user);
        if (visibility) {
            where.AND = [visibility];
        }

        const [events, total] = await Promise.all([
            this.prisma.event.findMany({
                where,
                include: eventInclude,
                orderBy: { startDate: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
            }),
            this.prisma.event.count({ where }),
        ]);

        return { data: events, total, page, limit, totalPages: Math.ceil(total / limit) };
    }

    async findOne(id: string, organizationId: string) {
        const event = await this.prisma.event.findFirst({
            where: { id, organizationId, kind: { not: EventKind.TURMA } },
            include: eventInclude,
        });
        if (!event) {
            throw new NotFoundException(`Evento com ID ${id} não encontrado nesta organização.`);
        }
        return event;
    }

    /**
     * Igual a `findOne`, mas aplicando a regra de visibilidade (ver
     * `canViewEvent`) — usado só pela rota de leitura direta (`GET
     * /events/:id`), nunca pelos métodos internos (`update`/`remove`/
     * `requireEventOperation`/`requireMeeting`), que continuam confiando só no
     * guard de permissão do próprio endpoint que os chama.
     */
    async findOneVisibleTo(id: string, organizationId: string, user: AuthenticatedUser) {
        const event = await this.findOne(id, organizationId);
        if (!(await this.canViewEvent(event, user))) {
            throw new NotFoundException(`Evento com ID ${id} não encontrado nesta organização.`);
        }
        return event;
    }

    /**
     * Mesma regra de `findOneVisibleTo`, pra usar em sub-recursos de evento
     * (escala, ocorrências, arquivos, postos) — bloqueia a leitura direta
     * desses sub-recursos por quem não pode ver o evento em si, mesmo que
     * essa pessoa já saiba o `eventId` (ex.: guardou o link antes de perder
     * a designação, ou tentou adivinhar/enumerar IDs).
     */
    async assertCanViewEvent(eventId: string, organizationId: string, user: AuthenticatedUser): Promise<void> {
        await this.findOneVisibleTo(eventId, organizationId, user);
    }

    async update(id: string, organizationId: string, dto: UpdateEventDto) {
        const existing = await this.findOne(id, organizationId);

        const startDate = dto.startDate !== undefined ? parseAppDateTime(dto.startDate) : existing.startDate;
        const endDate = dto.endDate !== undefined ? parseAppDateTime(dto.endDate) : (existing.endDate ?? undefined);
        if (endDate && endDate <= startDate) {
            throw new BadRequestException('A data/hora de término deve ser depois da data/hora de início.');
        }

        const updated = await this.prisma.$transaction(async (tx) => {
            await tx.event.update({
                where: { id },
                data: {
                    title: dto.title,
                    location: dto.location,
                    startDate: dto.startDate !== undefined ? startDate : undefined,
                    endDate: dto.endDate !== undefined ? endDate : undefined,
                    status: dto.status,
                },
            });

            if (dto.estimatedAudienceCount !== undefined || dto.notes !== undefined) {
                await tx.eventOperation.updateMany({
                    where: { eventId: id },
                    data: { estimatedAudienceCount: dto.estimatedAudienceCount, notes: dto.notes },
                });
            }

            return tx.event.findUniqueOrThrow({ where: { id }, include: eventInclude });
        });

        const reschedules = dto.title !== undefined || dto.location !== undefined || dto.startDate !== undefined || dto.endDate !== undefined;
        if (reschedules && updated.meeting?.googleEventId) {
            const startDate = updated.startDate;
            const endDate = updated.endDate ?? new Date(startDate.getTime() + 60 * 60 * 1000);
            await this.googleCalendarService.updateEvent(existing.createdByUserId, updated.meeting.googleEventId, {
                summary: updated.title,
                description: updated.meeting.agenda ?? undefined,
                location: updated.location ?? undefined,
                start: startDate,
                end: endDate,
            });
        }

        return updated;
    }

    async remove(id: string, organizationId: string) {
        const event = await this.findOne(id, organizationId);
        if (event.meeting?.googleEventId) {
            await this.googleCalendarService.deleteEvent(event.createdByUserId, event.meeting.googleEventId);
        }
        await this.prisma.event.delete({ where: { id } });
        return { id };
    }

    /** Resolve o `EventOperation` de um evento — usado por designations/occurrence-reports. */
    async requireEventOperation(eventId: string, organizationId: string) {
        const event = await this.findOne(eventId, organizationId);
        if (!event.operation) {
            throw new NotFoundException('Este evento não é uma assembleia, congresso ou atuação de brigada.');
        }
        return event.operation;
    }

    /** Resolve o `Meeting` de um evento — usado por meetings.service.ts. */
    async requireMeeting(eventId: string, organizationId: string) {
        const event = await this.findOne(eventId, organizationId);
        if (!event.meeting) {
            throw new NotFoundException('Este evento não é uma reunião.');
        }
        return event.meeting;
    }
}
