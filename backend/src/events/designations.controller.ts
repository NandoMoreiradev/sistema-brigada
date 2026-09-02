import { Controller, Get, Post, Body, Patch, Delete, Param, UseGuards, BadRequestException } from '@nestjs/common';
import { DesignationsService } from './designations.service';
import { CreateDesignationDto } from './dto/create-designation.dto';
import { UpdateDesignationStatusDto } from './dto/update-designation-status.dto';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { RolesGuard } from '../auth/guard/roles.guard';
import { Roles } from '../auth/decorator/roles.decorator';
import { Role } from '@prisma/client';
import { ActiveOrganizationId } from '../auth/common/active-organization-id.decorator';

const ADMIN_ROLES = [Role.SUPER_ADMIN, Role.GROUP_ADMIN, Role.ORG_ADMIN] as const;
const ALL_ORG_ROLES = [Role.SUPER_ADMIN, Role.GROUP_ADMIN, Role.ORG_ADMIN, Role.ORG_USER] as const;

@Controller('events/:eventId/designations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DesignationsController {
    constructor(private readonly designationsService: DesignationsService) {}

    private requireOrganizationId(organizationId: string | undefined): string {
        if (!organizationId) {
            throw new BadRequestException('Selecione uma organização ativa.');
        }
        return organizationId;
    }

    @Post()
    @Roles(...ADMIN_ROLES)
    create(
        @Param('eventId') eventId: string,
        @Body() dto: CreateDesignationDto,
        @ActiveOrganizationId() organizationId: string | undefined,
    ) {
        return this.designationsService.create(eventId, this.requireOrganizationId(organizationId), dto);
    }

    @Get()
    @Roles(...ALL_ORG_ROLES)
    findAll(@Param('eventId') eventId: string, @ActiveOrganizationId() organizationId: string | undefined) {
        return this.designationsService.findAll(eventId, this.requireOrganizationId(organizationId));
    }

    /** Confirmar/recusar a própria escala é o caso de uso mais comum — por isso liberado a qualquer papel autenticado. */
    @Patch(':designationId/status')
    @Roles(...ALL_ORG_ROLES)
    updateStatus(
        @Param('eventId') eventId: string,
        @Param('designationId') designationId: string,
        @Body() dto: UpdateDesignationStatusDto,
        @ActiveOrganizationId() organizationId: string | undefined,
    ) {
        return this.designationsService.updateStatus(eventId, this.requireOrganizationId(organizationId), designationId, dto.status);
    }

    @Delete(':designationId')
    @Roles(...ADMIN_ROLES)
    remove(
        @Param('eventId') eventId: string,
        @Param('designationId') designationId: string,
        @ActiveOrganizationId() organizationId: string | undefined,
    ) {
        return this.designationsService.remove(eventId, this.requireOrganizationId(organizationId), designationId);
    }
}
