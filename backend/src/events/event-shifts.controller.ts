import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, BadRequestException } from '@nestjs/common';
import { EventShiftsService } from './event-shifts.service';
import { CreateEventShiftDto, CreateEventShiftsBulkDto, UpdateEventShiftDto } from './dto/event-shift.dto';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { RolesGuard } from '../auth/guard/roles.guard';
import { PermissionsGuard, RequirePermission } from '../auth/guard/permissions.guard';
import { Roles } from '../auth/decorator/roles.decorator';
import { Role } from '@prisma/client';
import { ActiveOrganizationId } from '../auth/common/active-organization-id.decorator';
import { CurrentUser } from '../auth/common/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';

const ALL_ORG_ROLES = [Role.SUPER_ADMIN, Role.GROUP_ADMIN, Role.ORG_ADMIN, Role.ORG_USER] as const;

/** Turnos do evento — leitura aberta a quem pode ver o evento; gestão exige `events:manage`. */
@Controller('events/:eventId/shifts')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class EventShiftsController {
    constructor(private readonly eventShiftsService: EventShiftsService) {}

    private requireOrganizationId(organizationId: string | undefined): string {
        if (!organizationId) {
            throw new BadRequestException('Selecione uma organização ativa.');
        }
        return organizationId;
    }

    @Get()
    @Roles(...ALL_ORG_ROLES)
    findAll(
        @Param('eventId') eventId: string,
        @ActiveOrganizationId() organizationId: string | undefined,
        @CurrentUser() user: AuthenticatedUser,
    ) {
        return this.eventShiftsService.findAll(eventId, this.requireOrganizationId(organizationId), user);
    }

    @Post()
    @RequirePermission('events:manage')
    create(
        @Param('eventId') eventId: string,
        @Body() dto: CreateEventShiftDto,
        @ActiveOrganizationId() organizationId: string | undefined,
    ) {
        return this.eventShiftsService.create(eventId, this.requireOrganizationId(organizationId), dto);
    }

    /** Cria vários turnos de uma vez (cada modelo repetido em cada dia). */
    @Post('bulk')
    @RequirePermission('events:manage')
    createBulk(
        @Param('eventId') eventId: string,
        @Body() dto: CreateEventShiftsBulkDto,
        @ActiveOrganizationId() organizationId: string | undefined,
    ) {
        return this.eventShiftsService.createBulk(eventId, this.requireOrganizationId(organizationId), dto);
    }

    @Patch(':shiftId')
    @RequirePermission('events:manage')
    update(
        @Param('eventId') eventId: string,
        @Param('shiftId') shiftId: string,
        @Body() dto: UpdateEventShiftDto,
        @ActiveOrganizationId() organizationId: string | undefined,
    ) {
        return this.eventShiftsService.update(eventId, this.requireOrganizationId(organizationId), shiftId, dto);
    }

    @Delete(':shiftId')
    @RequirePermission('events:manage')
    remove(
        @Param('eventId') eventId: string,
        @Param('shiftId') shiftId: string,
        @ActiveOrganizationId() organizationId: string | undefined,
    ) {
        return this.eventShiftsService.remove(eventId, this.requireOrganizationId(organizationId), shiftId);
    }
}
