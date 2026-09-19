import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventsService } from './events.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateOccurrenceReportDto } from './dto/create-occurrence-report.dto';
import { Role } from '@prisma/client';

/** Tipos de ocorrência que merecem alerta imediato a quem administra eventos, não só ficar registrado na aba. */
const CRITICAL_OCCURRENCE_TYPES = ['MEDICAL', 'SAFETY'];

@Injectable()
export class OccurrenceReportsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly eventsService: EventsService,
        private readonly notificationsService: NotificationsService,
    ) {}

    async create(eventId: string, organizationId: string, createdByUserId: string, dto: CreateOccurrenceReportDto) {
        const event = await this.eventsService.findOne(eventId, organizationId);
        if (!event.operation) {
            throw new NotFoundException('Este evento não é uma assembleia, congresso ou atuação de brigada.');
        }

        const report = await this.prisma.occurrenceReport.create({
            data: {
                eventOperationId: event.operation.id,
                type: dto.type,
                title: dto.title,
                description: dto.description,
                createdByUserId,
            },
        });

        if (CRITICAL_OCCURRENCE_TYPES.includes(dto.type)) {
            const managers = await this.findEventManagers(organizationId);
            const typeLabel = dto.type === 'MEDICAL' ? 'médica' : 'de segurança';
            await Promise.all(
                managers
                    .filter((manager) => manager.id !== createdByUserId)
                    .map((manager) =>
                        this.notificationsService.create({
                            userId: manager.id,
                            organizationId,
                            type: 'OCCURRENCE_REPORT_CRITICAL',
                            title: `Ocorrência ${typeLabel} registrada`,
                            message: `"${dto.title}" foi registrada no evento "${event.title}".`,
                            link: `/events/${eventId}`,
                        }),
                    ),
            );
        }

        return report;
    }

    /** Quem administra eventos nesta organização: admins de organização/grupo, ou quem tem 'events:manage' via cargo/permissão direta. */
    private findEventManagers(organizationId: string) {
        return this.prisma.user.findMany({
            where: {
                organizationId,
                isActive: true,
                OR: [
                    { role: { in: [Role.GROUP_ADMIN, Role.ORG_ADMIN] } },
                    { directPermissions: { has: 'events:manage' } },
                    { roleAssignments: { some: { permissions: { some: { id: 'events:manage' } } } } },
                ],
            },
            select: { id: true },
        });
    }

    async findAll(eventId: string, organizationId: string) {
        const operation = await this.eventsService.requireEventOperation(eventId, organizationId);
        return this.prisma.occurrenceReport.findMany({
            where: { eventOperationId: operation.id },
            orderBy: { createdAt: 'desc' },
        });
    }

    async remove(eventId: string, organizationId: string, reportId: string) {
        const operation = await this.eventsService.requireEventOperation(eventId, organizationId);
        const report = await this.prisma.occurrenceReport.findFirst({ where: { id: reportId, eventOperationId: operation.id } });
        if (!report) {
            throw new NotFoundException(`Relatório com ID ${reportId} não encontrado neste evento.`);
        }
        await this.prisma.occurrenceReport.delete({ where: { id: reportId } });
        return { id: reportId };
    }
}
