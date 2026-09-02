import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventsService } from './events.service';
import { CreateOccurrenceReportDto } from './dto/create-occurrence-report.dto';

@Injectable()
export class OccurrenceReportsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly eventsService: EventsService,
    ) {}

    async create(eventId: string, organizationId: string, createdByUserId: string, dto: CreateOccurrenceReportDto) {
        const operation = await this.eventsService.requireEventOperation(eventId, organizationId);
        return this.prisma.occurrenceReport.create({
            data: {
                eventOperationId: operation.id,
                type: dto.type,
                title: dto.title,
                description: dto.description,
                createdByUserId,
            },
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
