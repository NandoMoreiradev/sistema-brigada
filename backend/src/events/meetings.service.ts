// backend/src/events/meetings.service.ts
// Reunião periódica (kind=REUNIAO): pauta/ata + presença. Diferente de
// ClassSession, não há uma "matrícula" prévia definindo quem deveria vir —
// por isso a presença é uma lista aberta (qualquer usuário da organização
// pode ser adicionado como presente/ausente), sem roster fixo pré-calculado.

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventsService } from './events.service';
import { UpdateMeetingDto } from './dto/update-meeting.dto';
import { MarkMeetingAttendanceDto } from './dto/mark-meeting-attendance.dto';

@Injectable()
export class MeetingsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly eventsService: EventsService,
    ) {}

    getOne(eventId: string, organizationId: string) {
        return this.eventsService.requireMeeting(eventId, organizationId);
    }

    async update(eventId: string, organizationId: string, dto: UpdateMeetingDto) {
        const meeting = await this.eventsService.requireMeeting(eventId, organizationId);
        return this.prisma.meeting.update({ where: { id: meeting.id }, data: dto });
    }

    async getAttendance(eventId: string, organizationId: string) {
        const meeting = await this.eventsService.requireMeeting(eventId, organizationId);
        return this.prisma.meetingAttendance.findMany({
            where: { meetingId: meeting.id },
            include: { user: { select: { id: true, name: true, email: true } } },
            orderBy: { user: { name: 'asc' } },
        });
    }

    async markAttendance(eventId: string, organizationId: string, dto: MarkMeetingAttendanceDto) {
        const meeting = await this.eventsService.requireMeeting(eventId, organizationId);

        const userIds = dto.records.map((r) => r.userId);
        const validUsers = await this.prisma.user.findMany({ where: { id: { in: userIds }, organizationId }, select: { id: true } });
        const validIds = new Set(validUsers.map((u) => u.id));
        const invalid = userIds.filter((id) => !validIds.has(id));
        if (invalid.length > 0) {
            throw new BadRequestException(`Usuário(s) não pertencem a esta organização: ${invalid.join(', ')}`);
        }

        await this.prisma.$transaction(
            dto.records.map((record) =>
                this.prisma.meetingAttendance.upsert({
                    where: { meetingId_userId: { meetingId: meeting.id, userId: record.userId } },
                    create: { meetingId: meeting.id, userId: record.userId, status: record.status },
                    update: { status: record.status },
                }),
            ),
        );

        return this.getAttendance(eventId, organizationId);
    }
}
