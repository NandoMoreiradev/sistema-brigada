// backend/src/events/events.service.ts
//
// CRUD do tronco polimórfico `Event` para os kinds que não são TURMA
// (decisão 2 do docs/decisoes.md — TURMA é exclusividade do módulo `courses`,
// que precisa criar Event+Course juntos). Ao criar um evento REUNIAO, tenta
// gerar automaticamente um link do Google Meet via `GoogleCalendarService`
// (usa a integração OAuth do usuário que está criando o evento) — se ele não
// tiver conectado o Google, o evento é criado normalmente sem `meetUrl`
// (preenchível depois à mão).

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, EventKind } from '@prisma/client';
import { GoogleCalendarService } from '../user-integrations/google-calendar/google-calendar.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { ListEventsDto } from './dto/list-events.dto';

const OPERATION_KINDS: EventKind[] = [EventKind.ASSEMBLEIA, EventKind.CONGRESSO, EventKind.ATUACAO_BRIGADA];

const eventInclude = {
    operation: { include: { _count: { select: { designations: true, occurrenceReports: true } } } },
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
        const startDate = new Date(dto.startDate);
        const endDate = dto.endDate ? new Date(dto.endDate) : undefined;

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

    async findAll(organizationId: string, query: ListEventsDto) {
        const { kind, search, page = 1, limit = 20 } = query;

        const where: Prisma.EventWhereInput = {
            organizationId,
            kind: kind ? kind : { in: OPERATION_KINDS.concat(EventKind.REUNIAO) },
        };
        if (search) {
            where.title = { contains: search, mode: 'insensitive' };
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

    async update(id: string, organizationId: string, dto: UpdateEventDto) {
        await this.findOne(id, organizationId);

        return this.prisma.$transaction(async (tx) => {
            await tx.event.update({
                where: { id },
                data: {
                    title: dto.title,
                    location: dto.location,
                    startDate: dto.startDate ? new Date(dto.startDate) : undefined,
                    endDate: dto.endDate ? new Date(dto.endDate) : undefined,
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
    }

    async remove(id: string, organizationId: string) {
        await this.findOne(id, organizationId);
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
