// backend/src/events/event-posts.service.ts
// Postos de atuação + planta baixa de um evento de operação (assembleia/
// congresso) — ver docs/decisoes.md. Um posto pode
// existir sem posição (posX/posY), e ganha posição quando alguém o
// posiciona na planta baixa; a planta baixa é uma imagem avulsa por evento.

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventsService } from './events.service';
import { CreateEventPostDto } from './dto/create-event-post.dto';
import { UpdateEventPostDto } from './dto/update-event-post.dto';
import { SetFloorPlanDto } from './dto/set-floor-plan.dto';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';

@Injectable()
export class EventPostsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly eventsService: EventsService,
    ) {}

    /**
     * Decide a planta do posto. Com `floorPlanId` explícito, ele precisa ser do evento. Sem ele e
     * com posição, vale a planta única do evento; havendo várias, é preciso escolher uma.
     */
    private async resolveFloorPlanId(eventOperationId: string, floorPlanId: string | undefined, hasPosition: boolean): Promise<string | undefined> {
        if (floorPlanId) {
            const plan = await this.prisma.eventFloorPlan.findFirst({ where: { id: floorPlanId, eventOperationId }, select: { id: true } });
            if (!plan) throw new BadRequestException('Planta informada não pertence a este evento.');
            return plan.id;
        }
        if (!hasPosition) return undefined;

        const plans = await this.prisma.eventFloorPlan.findMany({ where: { eventOperationId }, select: { id: true } });
        if (plans.length === 1) return plans[0].id;
        throw new BadRequestException(plans.length === 0 ? 'Envie a planta baixa antes de posicionar um posto.' : 'Escolha em qual planta o posto será posicionado.');
    }

    async create(eventId: string, organizationId: string, dto: CreateEventPostDto) {
        const operation = await this.eventsService.requireEventOperation(eventId, organizationId);
        const hasPosition = dto.posX !== undefined && dto.posY !== undefined;
        const floorPlanId = await this.resolveFloorPlanId(operation.id, dto.floorPlanId, hasPosition);
        return this.prisma.eventPost.create({
            data: {
                eventOperationId: operation.id,
                name: dto.name,
                capacity: dto.capacity,
                notes: dto.notes,
                posX: dto.posX,
                posY: dto.posY,
                floorPlanId,
            },
        });
    }

    async findAll(eventId: string, organizationId: string, user: AuthenticatedUser) {
        await this.eventsService.assertCanViewEvent(eventId, organizationId, user);
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

        const { floorPlanId, ...rest } = dto;
        const movingPlan = floorPlanId !== undefined && floorPlanId !== post.floorPlanId;
        const resolvedPlanId = await this.resolveFloorPlanId(
            operation.id,
            floorPlanId ?? post.floorPlanId ?? undefined,
            !post.floorPlanId && (dto.posX !== undefined || dto.posY !== undefined),
        );

        return this.prisma.eventPost.update({
            where: { id: postId },
            data: {
                ...rest,
                floorPlanId: resolvedPlanId,
                // Ao mudar de planta a posição antiga não vale na nova imagem: o posto reaparece no
                // centro da nova planta (a menos que a posição nova venha junto) para ser arrastado.
                ...(movingPlan ? { posX: dto.posX ?? 0.5, posY: dto.posY ?? 0.5 } : {}),
            },
        });
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

    /**
     * Legado (uma planta só por evento): agora troca a imagem da PRIMEIRA planta, criando a
     * "Planta 1" se o evento ainda não tem nenhuma. As telas novas usam /floor-plans.
     */
    async setFloorPlan(eventId: string, organizationId: string, dto: SetFloorPlanDto) {
        const operation = await this.eventsService.requireEventOperation(eventId, organizationId);
        const first = await this.prisma.eventFloorPlan.findFirst({ where: { eventOperationId: operation.id }, orderBy: { order: 'asc' } });
        if (first) {
            await this.prisma.eventFloorPlan.update({ where: { id: first.id }, data: { imageKey: dto.floorPlanKey, imageUrl: dto.floorPlanUrl } });
        } else {
            await this.prisma.eventFloorPlan.create({
                data: { eventOperationId: operation.id, name: 'Planta 1', imageKey: dto.floorPlanKey, imageUrl: dto.floorPlanUrl, order: 0 },
            });
        }
        await this.prisma.eventOperation.update({
            where: { id: operation.id },
            data: { floorPlanKey: dto.floorPlanKey, floorPlanUrl: dto.floorPlanUrl },
        });
        return { floorPlanKey: dto.floorPlanKey, floorPlanUrl: dto.floorPlanUrl };
    }
}
