import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query, BadRequestException } from '@nestjs/common';
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { ListEventsDto } from './dto/list-events.dto';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { RolesGuard } from '../auth/guard/roles.guard';
import { Roles } from '../auth/decorator/roles.decorator';
import { Role } from '@prisma/client';
import { ActiveOrganizationId } from '../auth/common/active-organization-id.decorator';
import { CurrentUser } from '../auth/common/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';

const ADMIN_ROLES = [Role.SUPER_ADMIN, Role.GROUP_ADMIN, Role.ORG_ADMIN] as const;
const ALL_ORG_ROLES = [Role.SUPER_ADMIN, Role.GROUP_ADMIN, Role.ORG_ADMIN, Role.ORG_USER] as const;

@Controller('events')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EventsController {
    constructor(private readonly eventsService: EventsService) {}

    private requireOrganizationId(organizationId: string | undefined): string {
        if (!organizationId) {
            throw new BadRequestException('Selecione uma organização ativa para gerenciar eventos.');
        }
        return organizationId;
    }

    @Post()
    @Roles(...ADMIN_ROLES)
    create(
        @Body() dto: CreateEventDto,
        @ActiveOrganizationId() organizationId: string | undefined,
        @CurrentUser() user: AuthenticatedUser,
    ) {
        return this.eventsService.create(dto, this.requireOrganizationId(organizationId), user.id);
    }

    @Get()
    @Roles(...ALL_ORG_ROLES)
    findAll(@Query() query: ListEventsDto, @ActiveOrganizationId() organizationId: string | undefined) {
        return this.eventsService.findAll(this.requireOrganizationId(organizationId), query);
    }

    @Get(':id')
    @Roles(...ALL_ORG_ROLES)
    findOne(@Param('id') id: string, @ActiveOrganizationId() organizationId: string | undefined) {
        return this.eventsService.findOne(id, this.requireOrganizationId(organizationId));
    }

    @Patch(':id')
    @Roles(...ADMIN_ROLES)
    update(
        @Param('id') id: string,
        @Body() dto: UpdateEventDto,
        @ActiveOrganizationId() organizationId: string | undefined,
    ) {
        return this.eventsService.update(id, this.requireOrganizationId(organizationId), dto);
    }

    @Delete(':id')
    @Roles(...ADMIN_ROLES)
    remove(@Param('id') id: string, @ActiveOrganizationId() organizationId: string | undefined) {
        return this.eventsService.remove(id, this.requireOrganizationId(organizationId));
    }
}
