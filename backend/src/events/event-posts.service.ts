// backend/src/events/event-posts.service.ts
// Postos de atuação + planta baixa de um evento de operação (assembleia/
// congresso/atuação de brigada) — ver docs/decisoes.md. Um posto pode
// existir sem posição (posX/posY), e ganha posição quando alguém o
// posiciona na planta baixa; a planta baixa é uma imagem avulsa por evento.

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventsService } from './events.service';
import { CreateEventPostDto } from './dto/create-event-post.dto';
import { UpdateEventPostDto } from './dto/update-event-post.dto';
import { SetFloorPlanDto } from './dto/set-floor-plan.dto';

@Injectable()
export class EventPostsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly eventsService: EventsService,
    ) {}

    async create(eventId: string, organizationId: string, dto: CreateEventPostDto) {
        const operation = await this.eventsService.requireEventOperation(eventId, organizationId);
        return this.prisma.eventPost.create({
            data: {
                eventOperationId: operation.id,
                name: dto.name,
                capacity: dto.capacity,
                notes: dto.notes,
                posX: dto.posX,
                posY: dto.posY,
            },
        });
    }

    async findAll(eventId: string, organizationId: string) {
        const operation = await this.eventsService.requireEventOperation(eventId, organizationId);
        return this.prisma.eventPost.findMany({
            where: { eventOperationId: operation.id },
            orderBy: { createdAt: 'asc' },
        });
    }

    async update(eventId: string, organizationId: string, postId: string, dto: UpdateEventPostDto) {
        const operation = await this.eventsService.requireEventOperation(eventId, organizationId);
        const post = await this.prisma.eventPost.findFirst({ where: { id: postId, eventOperationId: operation.id } });
        if (!post) {
            throw new NotFoundException(`Posto com ID ${postId} não encontrado neste evento.`);
        }
        return this.prisma.eventPost.update({ where: { id: postId }, data: dto });
    }

    async remove(eventId: string, organizationId: string, postId: string) {
        const operation = await this.eventsService.requireEventOperation(eventId, organizationId);
        const post = await this.prisma.eventPost.findFirst({ where: { id: postId, eventOperationId: operation.id } });
        if (!post) {
            throw new NotFoundException(`Posto com ID ${postId} não encontrado neste evento.`);
        }
        // Designation.postId é onDelete: SetNull — remover o posto só desvincula as designações, não as apaga.
        await this.prisma.eventPost.delete({ where: { id: postId } });
        return { id: postId };
    }

    async setFloorPlan(eventId: string, organizationId: string, dto: SetFloorPlanDto) {
        const operation = await this.eventsService.requireEventOperation(eventId, organizationId);
        await this.prisma.eventOperation.update({
            where: { id: operation.id },
            data: { floorPlanKey: dto.floorPlanKey, floorPlanUrl: dto.floorPlanUrl },
        });
        return { floorPlanKey: dto.floorPlanKey, floorPlanUrl: dto.floorPlanUrl };
    }
}
