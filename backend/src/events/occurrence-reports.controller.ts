import { Controller, Get, Post, Body, Delete, Param, UseGuards, BadRequestException } from '@nestjs/common';
import { OccurrenceReportsService } from './occurrence-reports.service';
import { CreateOccurrenceReportDto } from './dto/create-occurrence-report.dto';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { RolesGuard } from '../auth/guard/roles.guard';
import { PermissionsGuard, RequirePermission } from '../auth/guard/permissions.guard';
import { Roles } from '../auth/decorator/roles.decorator';
import { Role } from '@prisma/client';
import { ActiveOrganizationId } from '../auth/common/active-organization-id.decorator';
import { CurrentUser } from '../auth/common/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';

const ALL_ORG_ROLES = [Role.SUPER_ADMIN, Role.GROUP_ADMIN, Role.ORG_ADMIN, Role.ORG_USER] as const;

@Controller('events/:eventId/occurrence-reports')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class OccurrenceReportsController {
    constructor(private readonly occurrenceReportsService: OccurrenceReportsService) {}

    private requireOrganizationId(organizationId: string | undefined): string {
        if (!organizationId) {
            throw new BadRequestException('Selecione uma organização ativa.');
        }
        return organizationId;
    }

    /** Qualquer papel autenticado pode registrar ocorrência — é quem está em campo que percebe o incidente. */
    @Post()
    @Roles(...ALL_ORG_ROLES)
    create(
        @Param('eventId') eventId: string,
        @Body() dto: CreateOccurrenceReportDto,
        @ActiveOrganizationId() organizationId: string | undefined,
        @CurrentUser() user: AuthenticatedUser,
    ) {
        return this.occurrenceReportsService.create(eventId, this.requireOrganizationId(organizationId), user.id, dto);
    }

    @Get()
    @Roles(...ALL_ORG_ROLES)
    findAll(@Param('eventId') eventId: string, @ActiveOrganizationId() organizationId: string | undefined) {
        return this.occurrenceReportsService.findAll(eventId, this.requireOrganizationId(organizationId));
    }

    @Delete(':reportId')
    @RequirePermission('events:manage')
    remove(
        @Param('eventId') eventId: string,
        @Param('reportId') reportId: string,
        @ActiveOrganizationId() organizationId: string | undefined,
    ) {
        return this.occurrenceReportsService.remove(eventId, this.requireOrganizationId(organizationId), reportId);
    }
}
