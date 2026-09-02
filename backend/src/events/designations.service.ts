// backend/src/events/designations.service.ts
// Escala de staff em evento de atuação (decisão 14: turnos/horários, não uma
// designação única para o evento inteiro).

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventsService } from './events.service';
import { CreateDesignationDto } from './dto/create-designation.dto';
import { DesignationStatus } from '@prisma/client';

const designationInclude = {
    staffMember: { include: { user: { select: { id: true, name: true, email: true } } } },
} as const;

@Injectable()
export class DesignationsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly eventsService: EventsService,
    ) {}

    async create(eventId: string, organizationId: string, dto: CreateDesignationDto) {
        const operation = await this.eventsService.requireEventOperation(eventId, organizationId);

        const staffMember = await this.prisma.staffMember.findFirst({ where: { id: dto.staffMemberId, organizationId } });
        if (!staffMember) {
            throw new NotFoundException('Membro de equipe informado não pertence a esta organização.');
        }

        return this.prisma.designation.create({
            data: {
                eventOperationId: operation.id,
                staffMemberId: dto.staffMemberId,
                role: dto.role,
                shiftStart: new Date(dto.shiftStart),
                shiftEnd: new Date(dto.shiftEnd),
            },
            include: designationInclude,
        });
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
        const operation = await this.eventsService.requireEventOperation(eventId, organizationId);
        const designation = await this.prisma.designation.findFirst({ where: { id: designationId, eventOperationId: operation.id } });
        if (!designation) {
            throw new NotFoundException(`Designação com ID ${designationId} não encontrada neste evento.`);
        }
        return this.prisma.designation.update({ where: { id: designationId }, data: { status }, include: designationInclude });
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
