import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventsService } from './events.service';
import { CreateEventFileDto } from './dto/create-event-file.dto';
import { UpdateEventFileDto } from './dto/update-event-file.dto';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';

@Injectable()
export class EventFilesService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly eventsService: EventsService,
    ) {}

    async create(eventId: string, organizationId: string, uploadedByUserId: string, dto: CreateEventFileDto) {
        await this.eventsService.findOne(eventId, organizationId);
        return this.prisma.eventFile.create({
            data: {
                eventId,
                name: dto.name,
                storageKey: dto.storageKey,
                externalUrl: dto.externalUrl,
                mimeType: dto.mimeType,
                uploadedByUserId,
            },
        });
    }

    async findAll(eventId: string, organizationId: string, user: AuthenticatedUser) {
        await this.eventsService.assertCanViewEvent(eventId, organizationId, user);
        return this.prisma.eventFile.findMany({ where: { eventId }, orderBy: { createdAt: 'desc' } });
    }

    async update(eventId: string, organizationId: string, fileId: string, dto: UpdateEventFileDto) {
        await this.eventsService.findOne(eventId, organizationId);
        const file = await this.prisma.eventFile.findFirst({ where: { id: fileId, eventId } });
        if (!file) {
            throw new NotFoundException(`Arquivo com ID ${fileId} não encontrado neste evento.`);
        }
        return this.prisma.eventFile.update({
            where: { id: fileId },
            data: {
                name: dto.name,
                storageKey: dto.storageKey,
                externalUrl: dto.externalUrl,
                mimeType: dto.mimeType,
            },
        });
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
