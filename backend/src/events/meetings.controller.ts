import { Controller, Get, Patch, Put, Body, Param, UseGuards, BadRequestException } from '@nestjs/common';
import { MeetingsService } from './meetings.service';
import { UpdateMeetingDto } from './dto/update-meeting.dto';
import { MarkMeetingAttendanceDto } from './dto/mark-meeting-attendance.dto';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { RolesGuard } from '../auth/guard/roles.guard';
import { PermissionsGuard, RequirePermission } from '../auth/guard/permissions.guard';
import { Roles } from '../auth/decorator/roles.decorator';
import { Role } from '@prisma/client';
import { ActiveOrganizationId } from '../auth/common/active-organization-id.decorator';

const ALL_ORG_ROLES = [Role.SUPER_ADMIN, Role.GROUP_ADMIN, Role.ORG_ADMIN, Role.ORG_USER] as const;

@Controller('events/:eventId/meeting')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class MeetingsController {
    constructor(private readonly meetingsService: MeetingsService) {}

    private requireOrganizationId(organizationId: string | undefined): string {
        if (!organizationId) {
            throw new BadRequestException('Selecione uma organização ativa.');
        }
        return organizationId;
    }

    @Get()
    @Roles(...ALL_ORG_ROLES)
    getOne(@Param('eventId') eventId: string, @ActiveOrganizationId() organizationId: string | undefined) {
        return this.meetingsService.getOne(eventId, this.requireOrganizationId(organizationId));
    }

    @Patch()
    @RequirePermission('events:manage')
    update(
        @Param('eventId') eventId: string,
        @Body() dto: UpdateMeetingDto,
        @ActiveOrganizationId() organizationId: string | undefined,
    ) {
        return this.meetingsService.update(eventId, this.requireOrganizationId(organizationId), dto);
    }

    @Get('attendance')
    @Roles(...ALL_ORG_ROLES)
    getAttendance(@Param('eventId') eventId: string, @ActiveOrganizationId() organizationId: string | undefined) {
        return this.meetingsService.getAttendance(eventId, this.requireOrganizationId(organizationId));
    }

    @Put('attendance')
    @Roles(...ALL_ORG_ROLES)
    markAttendance(
        @Param('eventId') eventId: string,
        @Body() dto: MarkMeetingAttendanceDto,
        @ActiveOrganizationId() organizationId: string | undefined,
    ) {
        return this.meetingsService.markAttendance(eventId, this.requireOrganizationId(organizationId), dto);
    }
}
