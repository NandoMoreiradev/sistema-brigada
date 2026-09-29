import { Controller, Get, Post, Patch, Put, Delete, Body, Param, UseGuards, BadRequestException } from '@nestjs/common';
import { EventFloorPlansService } from './event-floor-plans.service';
import { CreateEventFloorPlanDto, ReorderEventFloorPlansDto, UpdateEventFloorPlanDto } from './dto/event-floor-plan.dto';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { RolesGuard } from '../auth/guard/roles.guard';
import { PermissionsGuard, RequirePermission } from '../auth/guard/permissions.guard';
import { Roles } from '../auth/decorator/roles.decorator';
import { Role } from '@prisma/client';
import { ActiveOrganizationId } from '../auth/common/active-organization-id.decorator';
import { CurrentUser } from '../auth/common/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';

const ALL_ORG_ROLES = [Role.SUPER_ADMIN, Role.GROUP_ADMIN, Role.ORG_ADMIN, Role.ORG_USER] as const;

/** Plantas baixas do evento — leitura aberta a quem pode ver o evento; gestão exige `events:manage`. */
@Controller('events/:eventId/floor-plans')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class EventFloorPlansController {
    constructor(private readonly floorPlansService: EventFloorPlansService) {}

    private requireOrganizationId(organizationId: string | undefined): string {
        if (!organizationId) {
            throw new BadRequestException('Selecione uma organização ativa.');
        }
        return organizationId;
    }

    @Get()
    @Roles(...ALL_ORG_ROLES)
    findAll(@Param('eventId') eventId: string, @ActiveOrganizationId() organizationId: string | undefined, @CurrentUser() user: AuthenticatedUser) {
        return this.floorPlansService.findAll(eventId, this.requireOrganizationId(organizationId), user);
    }

    @Post()
    @RequirePermission('events:manage')
    create(@Param('eventId') eventId: string, @Body() dto: CreateEventFloorPlanDto, @ActiveOrganizationId() organizationId: string | undefined) {
        return this.floorPlansService.create(eventId, this.requireOrganizationId(organizationId), dto);
    }

    /** Declarada antes de `:planId` para `order` não ser lido como id. */
    @Put('order')
    @RequirePermission('events:manage')
    reorder(@Param('eventId') eventId: string, @Body() dto: ReorderEventFloorPlansDto, @ActiveOrganizationId() organizationId: string | undefined) {
        return this.floorPlansService.reorder(eventId, this.requireOrganizationId(organizationId), dto);
    }

    @Patch(':planId')
    @RequirePermission('events:manage')
    update(
        @Param('eventId') eventId: string,
        @Param('planId') planId: string,
        @Body() dto: UpdateEventFloorPlanDto,
        @ActiveOrganizationId() organizationId: string | undefined,
    ) {
        return this.floorPlansService.update(eventId, this.requireOrganizationId(organizationId), planId, dto);
    }

    @Delete(':planId')
    @RequirePermission('events:manage')
    remove(@Param('eventId') eventId: string, @Param('planId') planId: string, @ActiveOrganizationId() organizationId: string | undefined) {
        return this.floorPlansService.remove(eventId, this.requireOrganizationId(organizationId), planId);
    }
}
