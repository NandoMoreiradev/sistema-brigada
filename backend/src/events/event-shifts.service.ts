// backend/src/events/event-shifts.service.ts
//
// Turnos do evento (EventShift): iguais para todos os postos; cada pessoa é escalada em um ou
// mais turnos. Remarcar um turno propaga o novo horário às designações dele (que guardam uma
// cópia de shiftStart/shiftEnd) — depois de revalidar o conflito de cada pessoa.

import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DesignationStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EventsService } from './events.service';
import { CreateEventShiftDto, CreateEventShiftsBulkDto, UpdateEventShiftDto } from './dto/event-shift.dto';
import { parseAppDateTime } from '../common/datetime';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { findConflictingDesignation } from './designation-conflicts.util';

const SHIFT_INCLUDE = { _count: { select: { designations: true } } } as const;

/** "yyyy-MM-dd" + 1 dia (aritmética de calendário, sem fuso). */
function addOneDay(day: string): string {
    const [y, m, d] = day.slice(0, 10).split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}

@Injectable()
export class EventShiftsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly eventsService: EventsService,
    ) {}

    async findAll(eventId: string, organizationId: string, user: AuthenticatedUser) {
        await this.eventsService.assertCanViewEvent(eventId, organizationId, user);
        const operation = await this.eventsService.requireEventOperation(eventId, organizationId);
        return this.prisma.eventShift.findMany({
            where: { eventOperationId: operation.id },
            include: SHIFT_INCLUDE,
            orderBy: [{ start: 'asc' }, { end: 'asc' }],
        });
    }

    async create(eventId: string, organizationId: string, dto: CreateEventShiftDto) {
        const operation = await this.eventsService.requireEventOperation(eventId, organizationId);
        const start = parseAppDateTime(dto.start);
        const end = parseAppDateTime(dto.end);
        if (end <= start) {
            throw new BadRequestException('O fim do turno deve ser depois do início.');
        }
        return this.createOne(operation.id, dto.name.trim(), start, end);
    }

    /** Repete cada modelo de turno em cada dia. Turnos que já existem (mesmo horário) são ignorados. */
    async createBulk(eventId: string, organizationId: string, dto: CreateEventShiftsBulkDto) {
        const operation = await this.eventsService.requireEventOperation(eventId, organizationId);

        const rows: { name: string; start: Date; end: Date }[] = [];
        for (const day of [...new Set(dto.days.map((d) => d.slice(0, 10)))]) {
            for (const template of dto.shifts) {
                const start = parseAppDateTime(`${day}T${template.startTime}`);
                // Fim <= início: o turno atravessa a meia-noite (ex.: Noite 22:00–02:00).
                const endDay = template.endTime <= template.startTime ? addOneDay(day) : day;
                const end = parseAppDateTime(`${endDay}T${template.endTime}`);
                rows.push({ name: template.name.trim(), start, end });
            }
        }

        const result = await this.prisma.eventShift.createMany({
            data: rows.map((row) => ({ eventOperationId: operation.id, ...row })),
            skipDuplicates: true,
        });

        return {
            created: result.count,
            skipped: rows.length - result.count,
            shifts: await this.prisma.eventShift.findMany({
                where: { eventOperationId: operation.id },
                include: SHIFT_INCLUDE,
                orderBy: [{ start: 'asc' }, { end: 'asc' }],
            }),
        };
    }

    private async createOne(eventOperationId: string, name: string, start: Date, end: Date) {
        try {
            return await this.prisma.eventShift.create({ data: { eventOperationId, name, start, end }, include: SHIFT_INCLUDE });
        } catch (error: unknown) {
            if ((error as { code?: string })?.code === 'P2002') {
                throw new ConflictException('Já existe um turno com esse mesmo horário neste evento.');
            }
            throw error;
        }
    }

    private async requireShift(eventId: string, organizationId: string, shiftId: string) {
        const operation = await this.eventsService.requireEventOperation(eventId, organizationId);
        const shift = await this.prisma.eventShift.findFirst({ where: { id: shiftId, eventOperationId: operation.id } });
        if (!shift) {
            throw new NotFoundException(`Turno com ID ${shiftId} não encontrado neste evento.`);
        }
        return shift;
    }

    async update(eventId: string, organizationId: string, shiftId: string, dto: UpdateEventShiftDto) {
        const shift = await this.requireShift(eventId, organizationId, shiftId);

        const start = dto.start !== undefined ? parseAppDateTime(dto.start) : shift.start;
        const end = dto.end !== undefined ? parseAppDateTime(dto.end) : shift.end;
        if (end <= start) {
            throw new BadRequestException('O fim do turno deve ser depois do início.');
        }
        const windowChanged = start.getTime() !== shift.start.getTime() || end.getTime() !== shift.end.getTime();

        if (windowChanged) {
            // Cada pessoa escalada neste turno precisa continuar sem conflito no novo horário.
            const designations = await this.prisma.designation.findMany({
                where: { shiftId, status: { not: DesignationStatus.DECLINED } },
                include: { staffMember: { include: { user: { select: { name: true } } } } },
            });
            for (const designation of designations) {
                const conflict = await findConflictingDesignation(this.prisma, designation.staffMemberId, start, end, designation.id);
                if (conflict) {
                    throw new BadRequestException(
                        `${designation.staffMember.user.name} já está escalado(a) no evento "${conflict.eventOperation.event.title}" ` +
                            'em um turno que conflita com o novo horário.',
                    );
                }
            }
        }

        try {
            return await this.prisma.$transaction(async (tx) => {
                const updated = await tx.eventShift.update({
                    where: { id: shiftId },
                    data: { name: dto.name?.trim(), start, end },
                    include: SHIFT_INCLUDE,
                });
                if (windowChanged) {
                    await tx.designation.updateMany({ where: { shiftId }, data: { shiftStart: start, shiftEnd: end } });
                }
                return updated;
            });
        } catch (error: unknown) {
            if ((error as { code?: string })?.code === 'P2002') {
                throw new ConflictException('Já existe um turno com esse mesmo horário neste evento.');
            }
            throw error;
        }
    }

    async remove(eventId: string, organizationId: string, shiftId: string) {
        await this.requireShift(eventId, organizationId, shiftId);
        const count = await this.prisma.designation.count({ where: { shiftId } });
        if (count > 0) {
            throw new ConflictException(`Este turno tem ${count} designação(ões). Remova ou mova essas escalas antes de excluir o turno.`);
        }
        await this.prisma.eventShift.delete({ where: { id: shiftId } });
        return { id: shiftId };
    }
}
