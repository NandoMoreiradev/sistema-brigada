import { Controller, Get, Post, Body, Delete, Param, UseGuards, BadRequestException } from '@nestjs/common';
import { OccurrenceReportFilesService } from './occurrence-report-files.service';
import { CreateOccurrenceReportFileDto } from './dto/create-occurrence-report-file.dto';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { RolesGuard } from '../auth/guard/roles.guard';
import { PermissionsGuard } from '../auth/guard/permissions.guard';
import { Roles } from '../auth/decorator/roles.decorator';
import { Role } from '@prisma/client';
import { ActiveOrganizationId } from '../auth/common/active-organization-id.decorator';
import { CurrentUser } from '../auth/common/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';

const ALL_ORG_ROLES = [Role.SUPER_ADMIN, Role.GROUP_ADMIN, Role.ORG_ADMIN, Role.ORG_USER] as const;

@Controller('events/:eventId/occurrence-reports/:reportId/files')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class OccurrenceReportFilesController {
    constructor(private readonly occurrenceReportFilesService: OccurrenceReportFilesService) {}

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
        @Param('reportId') reportId: string,
        @Body() dto: CreateOccurrenceReportFileDto,
        @ActiveOrganizationId() organizationId: string | undefined,
        @CurrentUser() user: AuthenticatedUser,
    ) {
        return this.occurrenceReportFilesService.create(eventId, this.requireOrganizationId(organizationId), reportId, user.id, user, dto);
    }

    @Get()
    @Roles(...ALL_ORG_ROLES)
    findAll(
        @Param('eventId') eventId: string,
        @Param('reportId') reportId: string,
        @ActiveOrganizationId() organizationId: string | undefined,
        @CurrentUser() user: AuthenticatedUser,
    ) {
        return this.occurrenceReportFilesService.findAll(eventId, this.requireOrganizationId(organizationId), reportId, user);
    }

    @Delete(':fileId')
    @Roles(...ALL_ORG_ROLES)
    remove(
        @Param('eventId') eventId: string,
        @Param('reportId') reportId: string,
        @Param('fileId') fileId: string,
        @ActiveOrganizationId() organizationId: string | undefined,
        @CurrentUser() user: AuthenticatedUser,
    ) {
        return this.occurrenceReportFilesService.remove(eventId, this.requireOrganizationId(organizationId), reportId, fileId, user);
    }
}
