// backend/src/events/designations.service.ts
// Escala de staff em evento de atuação (decisão 14: turnos/horários, não uma
// designação única para o evento inteiro).

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventsService } from './events.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateDesignationDto } from './dto/create-designation.dto';
import { DesignationStatus } from '@prisma/client';
import { parseAppDateTime } from '../common/datetime';

const designationInclude = {
    staffMember: { include: { user: { select: { id: true, name: true, email: true } } } },
} as const;

@Injectable()
export class DesignationsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly eventsService: EventsService,
        private readonly notificationsService: NotificationsService,
    ) {}

    async create(eventId: string, organizationId: string, dto: CreateDesignationDto) {
        const event = await this.eventsService.findOne(eventId, organizationId);
        if (!event.operation) {
            throw new NotFoundException('Este evento não é uma assembleia, congresso ou atuação de brigada.');
        }

        const shiftStart = parseAppDateTime(dto.shiftStart);
        const shiftEnd = parseAppDateTime(dto.shiftEnd);
        if (shiftEnd <= shiftStart) {
            throw new BadRequestException('O fim do turno deve ser depois do início do turno.');
        }

        const staffMember = await this.prisma.staffMember.findFirst({
            where: { id: dto.staffMemberId, organizationId },
            include: { user: { select: { id: true, name: true, email: true } } },
        });
        if (!staffMember) {
            throw new NotFoundException('Membro de equipe informado não pertence a esta organização.');
        }

        // Mesmo brigadista não pode estar escalado em dois turnos que se
        // sobrepõem — mesmo em eventos diferentes. Ignora designações já
        // recusadas: uma recusa libera o horário.
        const conflicting = await this.prisma.designation.findFirst({
            where: {
                staffMemberId: dto.staffMemberId,
                status: { not: DesignationStatus.DECLINED },
                shiftStart: { lt: shiftEnd },
                shiftEnd: { gt: shiftStart },
            },
            include: { eventOperation: { include: { event: { select: { title: true } } } } },
        });
        if (conflicting) {
            throw new BadRequestException(
                `${staffMember.user.name} já está escalado(a) no evento "${conflicting.eventOperation.event.title}" ` +
                    `em um turno que conflita com o horário informado.`,
            );
        }

        const designation = await this.prisma.designation.create({
            data: {
                eventOperationId: event.operation.id,
                staffMemberId: dto.staffMemberId,
                role: dto.role,
                shiftStart,
                shiftEnd,
            },
            include: designationInclude,
        });

        await this.notificationsService.create({
            userId: staffMember.user.id,
            organizationId,
            type: 'DESIGNATION_ASSIGNED',
            title: 'Nova designação',
            message: `Você foi designado(a) como ${dto.role} para o evento "${event.title}".`,
            link: `/events/${eventId}`,
        });

        return designation;
    }

    async findAll(eventId: string, organizationId: string) {
        const operation = await this.eventsService.requireEventOperation(eventId, organizationId);
        return this.prisma.designation.findMany({
            where: { eventOperationId: operation.id },
            include: designationInclude,
            orderBy: { shiftStart: 'asc' },
        });
    }

    async updateStatus(eventId: string, organizationId: string, designationId: string, status: DesignationStatus) {
        const event = await this.eventsService.findOne(eventId, organizationId);
        if (!event.operation) {
            throw new NotFoundException('Este evento não é uma assembleia, congresso ou atuação de brigada.');
        }
        const designation = await this.prisma.designation.findFirst({
            where: { id: designationId, eventOperationId: event.operation.id },
            include: designationInclude,
        });
        if (!designation) {
            throw new NotFoundException(`Designação com ID ${designationId} não encontrada neste evento.`);
        }

        const updated = await this.prisma.designation.update({ where: { id: designationId }, data: { status }, include: designationInclude });

        // Quem organizou o evento precisa saber que uma vaga da escala ficou
        // aberta de novo — sem isso, só descobre olhando a aba manualmente.
        if (status === DesignationStatus.DECLINED && event.createdByUserId !== designation.staffMember.user.id) {
            await this.notificationsService.create({
                userId: event.createdByUserId,
                organizationId,
                type: 'DESIGNATION_DECLINED',
                title: 'Designação recusada',
                message: `${designation.staffMember.user.name} recusou a designação de ${designation.role} no evento "${event.title}".`,
                link: `/events/${eventId}`,
            });
        }

        return updated;
    }

    async remove(eventId: string, organizationId: string, designationId: string) {
        const operation = await this.eventsService.requireEventOperation(eventId, organizationId);
        const designation = await this.prisma.designation.findFirst({ where: { id: designationId, eventOperationId: operation.id } });
        if (!designation) {
            throw new NotFoundException(`Designação com ID ${designationId} não encontrada neste evento.`);
        }
        await this.prisma.designation.delete({ where: { id: designationId } });
        return { id: designationId };
    }
}
