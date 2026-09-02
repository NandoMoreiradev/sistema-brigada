import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventsService } from './events.service';
import { CreateEventFileDto } from './dto/create-event-file.dto';

@Injectable()
export class EventFilesService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly eventsService: EventsService,
    ) {}

    async create(eventId: string, organizationId: string, uploadedByUserId: string, dto: CreateEventFileDto) {
        await this.eventsService.findOne(eventId, organizationId);
        return this.prisma.eventFile.create({
            data: { eventId, name: dto.name, storageKey: dto.storageKey, externalUrl: dto.externalUrl, uploadedByUserId },
        });
    }

    async findAll(eventId: string, organizationId: string) {
        await this.eventsService.findOne(eventId, organizationId);
        return this.prisma.eventFile.findMany({ where: { eventId }, orderBy: { createdAt: 'desc' } });
    }

    async remove(eventId: string, organizationId: string, fileId: string) {
        await this.eventsService.findOne(eventId, organizationId);
        const file = await this.prisma.eventFile.findFirst({ where: { id: fileId, eventId } });
        if (!file) {
            throw new NotFoundException(`Arquivo com ID ${fileId} não encontrado neste evento.`);
        }
        await this.prisma.eventFile.delete({ where: { id: fileId } });
        return { id: fileId };
    }
}
