// backend/src/events/event-floor-plans.service.ts
//
// Plantas baixas do evento: áreas/andares que funcionam AO MESMO TEMPO (Térreo, Mezanino, Externa).
// Cada posto pertence a uma planta. Regras: no máximo 10 plantas; a partir da segunda o nome é
// obrigatório e único no evento; só se remove uma planta sem postos.

import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventsService } from './events.service';
import { CreateEventFloorPlanDto, ReorderEventFloorPlansDto, UpdateEventFloorPlanDto } from './dto/event-floor-plan.dto';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';

export const MAX_FLOOR_PLANS = 10;

const PLAN_INCLUDE = { _count: { select: { posts: true } } } as const;

@Injectable()
export class EventFloorPlansService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly eventsService: EventsService,
    ) {}

    async findAll(eventId: string, organizationId: string, user: AuthenticatedUser) {
        await this.eventsService.assertCanViewEvent(eventId, organizationId, user);
        const operation = await this.eventsService.requireEventOperation(eventId, organizationId);
        return this.prisma.eventFloorPlan.findMany({
            where: { eventOperationId: operation.id },
            include: PLAN_INCLUDE,
            orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
        });
    }

    private async requirePlan(eventId: string, organizationId: string, planId: string) {
        const operation = await this.eventsService.requireEventOperation(eventId, organizationId);
        const plan = await this.prisma.eventFloorPlan.findFirst({ where: { id: planId, eventOperationId: operation.id } });
        if (!plan) {
            throw new NotFoundException(`Planta com ID ${planId} não encontrada neste evento.`);
        }
        return { operation, plan };
    }

    private async assertNameFree(eventOperationId: string, name: string, exceptId?: string) {
        const existing = await this.prisma.eventFloorPlan.findMany({ where: { eventOperationId }, select: { id: true, name: true } });
        const clash = existing.some((p) => p.id !== exceptId && p.name.trim().toLowerCase() === name.trim().toLowerCase());
        if (clash) {
            throw new ConflictException(`Já existe uma planta chamada "${name.trim()}" neste evento.`);
        }
    }

    async create(eventId: string, organizationId: string, dto: CreateEventFloorPlanDto) {
        const operation = await this.eventsService.requireEventOperation(eventId, organizationId);
        const count = await this.prisma.eventFloorPlan.count({ where: { eventOperationId: operation.id } });

        if (count >= MAX_FLOOR_PLANS) {
            throw new BadRequestException(`Um evento pode ter no máximo ${MAX_FLOOR_PLANS} plantas.`);
        }

        const typed = dto.name?.trim();
        // A partir da segunda planta o nome é obrigatório (as abas e as folhas dependem dele).
        if (count >= 1 && !typed) {
            throw new BadRequestException('Informe o nome da planta (ex.: Mezanino, Área externa).');
        }
        const name = typed || 'Planta 1';
        await this.assertNameFree(operation.id, name);

        return this.prisma.eventFloorPlan.create({
            data: { eventOperationId: operation.id, name, imageKey: dto.imageKey, imageUrl: dto.imageUrl, order: count },
            include: PLAN_INCLUDE,
        });
    }

    async update(eventId: string, organizationId: string, planId: string, dto: UpdateEventFloorPlanDto) {
        const { operation } = await this.requirePlan(eventId, organizationId, planId);
        const name = dto.name?.trim();
        if (name !== undefined) {
            if (!name) throw new BadRequestException('O nome da planta não pode ficar vazio.');
            await this.assertNameFree(operation.id, name, planId);
        }
        return this.prisma.eventFloorPlan.update({
            where: { id: planId },
            data: { name, imageKey: dto.imageKey, imageUrl: dto.imageUrl },
            include: PLAN_INCLUDE,
        });
    }

    /** Define a ordem das abas. Precisa listar todas as plantas do evento, sem repetir. */
    async reorder(eventId: string, organizationId: string, dto: ReorderEventFloorPlansDto) {
        const operation = await this.eventsService.requireEventOperation(eventId, organizationId);
        const plans = await this.prisma.eventFloorPlan.findMany({ where: { eventOperationId: operation.id }, select: { id: true } });
        const ids = [...new Set(dto.ids)];
        if (ids.length !== plans.length || !plans.every((p) => ids.includes(p.id))) {
            throw new BadRequestException('Informe todas as plantas do evento, sem repetir.');
        }
        await this.prisma.$transaction(ids.map((id, order) => this.prisma.eventFloorPlan.update({ where: { id }, data: { order } })));
        return this.prisma.eventFloorPlan.findMany({ where: { eventOperationId: operation.id }, include: PLAN_INCLUDE, orderBy: { order: 'asc' } });
    }

    async remove(eventId: string, organizationId: string, planId: string) {
        const { operation, plan } = await this.requirePlan(eventId, organizationId, planId);
        const postCount = await this.prisma.eventPost.count({ where: { floorPlanId: plan.id } });
        if (postCount > 0) {
            throw new ConflictException(`A planta "${plan.name}" tem ${postCount} posto(s). Mova ou remova os postos antes de excluir a planta.`);
        }
        await this.prisma.eventFloorPlan.delete({ where: { id: planId } });
        // Mantém as abas numeradas em sequência.
        const rest = await this.prisma.eventFloorPlan.findMany({ where: { eventOperationId: operation.id }, orderBy: { order: 'asc' }, select: { id: true } });
        await this.prisma.$transaction(rest.map((p, order) => this.prisma.eventFloorPlan.update({ where: { id: p.id }, data: { order } })));
        return { id: planId };
    }
}
