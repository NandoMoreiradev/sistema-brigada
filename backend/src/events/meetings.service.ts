// backend/src/events/meetings.service.ts
// Reunião periódica (kind=REUNIAO): pauta/ata + presença. Diferente de
// ClassSession, não há uma "matrícula" prévia definindo quem deveria vir —
// por isso a presença é uma lista aberta (qualquer usuário da organização
// pode ser adicionado como presente/ausente), sem roster fixo pré-calculado.
//
// Quem pode registrar a presença de quem: cada usuário só pode marcar a
// PRÓPRIA presença, e uma única vez (autoconfirmação, não editável depois
// por ele mesmo). Quem tem a permissão `events:manage` pode registrar ou
// corrigir a presença de qualquer pessoa da organização, a qualquer momento.

import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventsService } from './events.service';
import { UpdateMeetingDto } from './dto/update-meeting.dto';
import { MarkMeetingAttendanceDto } from './dto/mark-meeting-attendance.dto';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { userHasPermission } from '../auth/guard/permissions.guard';

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

    async markAttendance(eventId: string, organizationId: string, dto: MarkMeetingAttendanceDto, currentUser: AuthenticatedUser) {
        const meeting = await this.eventsService.requireMeeting(eventId, organizationId);
        const canManageOthers = userHasPermission(currentUser, 'events:manage');

        if (!canManageOthers) {
            if (dto.records.length !== 1 || dto.records[0].userId !== currentUser.id) {
                throw new ForbiddenException('Você só pode marcar a própria presença.');
            }

            const existing = await this.prisma.meetingAttendance.findUnique({
                where: { meetingId_userId: { meetingId: meeting.id, userId: currentUser.id } },
            });
            if (existing) {
                throw new BadRequestException('Sua presença já foi registrada e não pode ser alterada.');
            }
        }

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
