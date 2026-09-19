import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, BadRequestException } from '@nestjs/common';
import { EventPostsService } from './event-posts.service';
import { CreateEventPostDto } from './dto/create-event-post.dto';
import { UpdateEventPostDto } from './dto/update-event-post.dto';
import { SetFloorPlanDto } from './dto/set-floor-plan.dto';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { RolesGuard } from '../auth/guard/roles.guard';
import { PermissionsGuard, RequirePermission } from '../auth/guard/permissions.guard';
import { Roles } from '../auth/decorator/roles.decorator';
import { Role } from '@prisma/client';
import { ActiveOrganizationId } from '../auth/common/active-organization-id.decorator';

const ALL_ORG_ROLES = [Role.SUPER_ADMIN, Role.GROUP_ADMIN, Role.ORG_ADMIN, Role.ORG_USER] as const;

@Controller('events/:eventId/posts')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class EventPostsController {
    constructor(private readonly eventPostsService: EventPostsService) {}

    private requireOrganizationId(organizationId: string | undefined): string {
        if (!organizationId) {
            throw new BadRequestException('Selecione uma organização ativa.');
        }
        return organizationId;
    }

    @Post()
    @RequirePermission('events:manage')
    create(
        @Param('eventId') eventId: string,
        @Body() dto: CreateEventPostDto,
        @ActiveOrganizationId() organizationId: string | undefined,
    ) {
        return this.eventPostsService.create(eventId, this.requireOrganizationId(organizationId), dto);
    }

    @Get()
    @Roles(...ALL_ORG_ROLES)
    findAll(@Param('eventId') eventId: string, @ActiveOrganizationId() organizationId: string | undefined) {
        return this.eventPostsService.findAll(eventId, this.requireOrganizationId(organizationId));
    }

    @Patch('floor-plan')
    @RequirePermission('events:manage')
    setFloorPlan(
        @Param('eventId') eventId: string,
        @Body() dto: SetFloorPlanDto,
        @ActiveOrganizationId() organizationId: string | undefined,
    ) {
        return this.eventPostsService.setFloorPlan(eventId, this.requireOrganizationId(organizationId), dto);
    }

    @Patch(':postId')
    @RequirePermission('events:manage')
    update(
        @Param('eventId') eventId: string,
        @Param('postId') postId: string,
        @Body() dto: UpdateEventPostDto,
        @ActiveOrganizationId() organizationId: string | undefined,
    ) {
        return this.eventPostsService.update(eventId, this.requireOrganizationId(organizationId), postId, dto);
    }

    @Delete(':postId')
    @RequirePermission('events:manage')
    remove(
        @Param('eventId') eventId: string,
        @Param('postId') postId: string,
        @ActiveOrganizationId() organizationId: string | undefined,
    ) {
        return this.eventPostsService.remove(eventId, this.requireOrganizationId(organizationId), postId);
    }
}
