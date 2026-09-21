// backend/src/events/occurrence-report-files.service.ts
// Anexos (fotos/documentos) de um relatório de ocorrência — complementa o
// áudio único já suportado em OccurrenceReport.audioUrl. Mesma regra de posse
// do relatório em si (occurrence-reports.service.ts): quem registrou o
// relatório pode anexar/remover arquivos; senão, exige 'events:manage'.

import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventsService } from './events.service';
import { CreateOccurrenceReportFileDto } from './dto/create-occurrence-report-file.dto';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { userHasPermission } from '../auth/common/user-has-permission.util';

@Injectable()
export class OccurrenceReportFilesService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly eventsService: EventsService,
    ) {}

    private async requireReport(eventId: string, organizationId: string, reportId: string) {
        const operation = await this.eventsService.requireEventOperation(eventId, organizationId);
        const report = await this.prisma.occurrenceReport.findFirst({ where: { id: reportId, eventOperationId: operation.id } });
        if (!report) {
            throw new NotFoundException(`Relatório com ID ${reportId} não encontrado neste evento.`);
        }
        return report;
    }

    async create(
        eventId: string,
        organizationId: string,
        reportId: string,
        uploadedByUserId: string,
        user: AuthenticatedUser,
        dto: CreateOccurrenceReportFileDto,
    ) {
        const report = await this.requireReport(eventId, organizationId, reportId);

        const isOwnReport = report.createdByUserId === user.id;
        if (!isOwnReport && !userHasPermission(user, 'events:manage')) {
            throw new ForbiddenException('Você só pode anexar arquivos ao próprio relatório de ocorrência.');
        }

        return this.prisma.occurrenceReportFile.create({
            data: {
                occurrenceReportId: reportId,
                name: dto.name,
                storageKey: dto.storageKey,
                externalUrl: dto.externalUrl,
                mimeType: dto.mimeType,
                uploadedByUserId,
            },
        });
    }

    async findAll(eventId: string, organizationId: string, reportId: string, user: AuthenticatedUser) {
        await this.eventsService.assertCanViewEvent(eventId, organizationId, user);
        await this.requireReport(eventId, organizationId, reportId);
        return this.prisma.occurrenceReportFile.findMany({ where: { occurrenceReportId: reportId }, orderBy: { createdAt: 'desc' } });
    }

    async remove(eventId: string, organizationId: string, reportId: string, fileId: string, user: AuthenticatedUser) {
        const report = await this.requireReport(eventId, organizationId, reportId);

        const isOwnReport = report.createdByUserId === user.id;
        if (!isOwnReport && !userHasPermission(user, 'events:manage')) {
            throw new ForbiddenException('Você só pode remover arquivos do próprio relatório de ocorrência.');
        }

        const file = await this.prisma.occurrenceReportFile.findFirst({ where: { id: fileId, occurrenceReportId: reportId } });
        if (!file) {
            throw new NotFoundException(`Arquivo com ID ${fileId} não encontrado neste relatório.`);
        }
        await this.prisma.occurrenceReportFile.delete({ where: { id: fileId } });
        return { id: fileId };
    }
}
