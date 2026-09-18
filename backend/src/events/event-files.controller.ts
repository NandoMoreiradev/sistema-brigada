import { Controller, Get, Post, Body, Delete, Param, UseGuards, BadRequestException } from '@nestjs/common';
import { EventFilesService } from './event-files.service';
import { CreateEventFileDto } from './dto/create-event-file.dto';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { RolesGuard } from '../auth/guard/roles.guard';
import { PermissionsGuard, RequirePermission } from '../auth/guard/permissions.guard';
import { Roles } from '../auth/decorator/roles.decorator';
import { Role } from '@prisma/client';
import { ActiveOrganizationId } from '../auth/common/active-organization-id.decorator';
import { CurrentUser } from '../auth/common/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';

const ALL_ORG_ROLES = [Role.SUPER_ADMIN, Role.GROUP_ADMIN, Role.ORG_ADMIN, Role.ORG_USER] as const;

@Controller('events/:eventId/files')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class EventFilesController {
    constructor(private readonly eventFilesService: EventFilesService) {}

    private requireOrganizationId(organizationId: string | undefined): string {
        if (!organizationId) {
            throw new BadRequestException('Selecione uma organização ativa.');
        }
        return organizationId;
    }

    @Post()
    @Roles(...ALL_ORG_ROLES)
    create(
        @Param('eventId') eventId: string,
        @Body() dto: CreateEventFileDto,
        @ActiveOrganizationId() organizationId: string | undefined,
        @CurrentUser() user: AuthenticatedUser,
    ) {
        return this.eventFilesService.create(eventId, this.requireOrganizationId(organizationId), user.id, dto);
    }

    @Get()
    @Roles(...ALL_ORG_ROLES)
    findAll(@Param('eventId') eventId: string, @ActiveOrganizationId() organizationId: string | undefined) {
        return this.eventFilesService.findAll(eventId, this.requireOrganizationId(organizationId));
    }

    @Delete(':fileId')
    @RequirePermission('events:manage')
    remove(
        @Param('eventId') eventId: string,
        @Param('fileId') fileId: string,
        @ActiveOrganizationId() organizationId: string | undefined,
    ) {
        return this.eventFilesService.remove(eventId, this.requireOrganizationId(organizationId), fileId);
    }
}
