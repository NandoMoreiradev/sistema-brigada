import { Controller, Get, Post, Body, Patch, Delete, Param, UseGuards, BadRequestException } from '@nestjs/common';
import { DesignationsService } from './designations.service';
import { CreateDesignationDto } from './dto/create-designation.dto';
import { CreateBulkDesignationDto } from './dto/create-bulk-designation.dto';
import { UpdateDesignationDto } from './dto/update-designation.dto';
import { UpdateDesignationStatusDto } from './dto/update-designation-status.dto';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { RolesGuard } from '../auth/guard/roles.guard';
import { PermissionsGuard, RequirePermission } from '../auth/guard/permissions.guard';
import { Roles } from '../auth/decorator/roles.decorator';
import { Role } from '@prisma/client';
import { ActiveOrganizationId } from '../auth/common/active-organization-id.decorator';
import { CurrentUser } from '../auth/common/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';

const ALL_ORG_ROLES = [Role.SUPER_ADMIN, Role.GROUP_ADMIN, Role.ORG_ADMIN, Role.ORG_USER] as const;

@Controller('events/:eventId/designations')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class DesignationsController {
    constructor(private readonly designationsService: DesignationsService) {}

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
        @Body() dto: CreateDesignationDto,
        @ActiveOrganizationId() organizationId: string | undefined,
    ) {
        return this.designationsService.create(eventId, this.requireOrganizationId(organizationId), dto);
    }

    /** Escala várias pessoas de uma vez pro mesmo turno/posto — opcionalmente formando uma dupla/trio/equipe (asTeam). */
    @Post('bulk')
    @RequirePermission('events:manage')
    createBulk(
        @Param('eventId') eventId: string,
        @Body() dto: CreateBulkDesignationDto,
        @ActiveOrganizationId() organizationId: string | undefined,
    ) {
        return this.designationsService.createBulk(eventId, this.requireOrganizationId(organizationId), dto);
    }

    @Get()
    @Roles(...ALL_ORG_ROLES)
    findAll(
        @Param('eventId') eventId: string,
        @ActiveOrganizationId() organizationId: string | undefined,
        @CurrentUser() user: AuthenticatedUser,
    ) {
        return this.designationsService.findAll(eventId, this.requireOrganizationId(organizationId), user);
    }

    @Patch(':designationId')
    @RequirePermission('events:manage')
    update(
        @Param('eventId') eventId: string,
        @Param('designationId') designationId: string,
        @Body() dto: UpdateDesignationDto,
        @ActiveOrganizationId() organizationId: string | undefined,
    ) {
        return this.designationsService.update(eventId, this.requireOrganizationId(organizationId), designationId, dto);
    }

    /**
     * Confirmar/recusar a própria escala é o caso de uso mais comum — por isso
     * o guard de role fica aberto a qualquer papel autenticado. A posse (só a
     * própria designação, a menos que tenha `events:manage`) é checada dentro
     * de DesignationsService.updateStatus (Fase 2, docs/decisoes.md).
     */
    @Patch(':designationId/status')
    @Roles(...ALL_ORG_ROLES)
    updateStatus(
        @Param('eventId') eventId: string,
        @Param('designationId') designationId: string,
        @Body() dto: UpdateDesignationStatusDto,
        @ActiveOrganizationId() organizationId: string | undefined,
        @CurrentUser() user: AuthenticatedUser,
    ) {
        return this.designationsService.updateStatus(
            eventId,
            this.requireOrganizationId(organizationId),
            designationId,
            dto.status,
            user,
        );
    }

    @Delete(':designationId')
    @RequirePermission('events:manage')
    remove(
        @Param('eventId') eventId: string,
        @Param('designationId') designationId: string,
        @ActiveOrganizationId() organizationId: string | undefined,
    ) {
        return this.designationsService.remove(eventId, this.requireOrganizationId(organizationId), designationId);
    }
}
