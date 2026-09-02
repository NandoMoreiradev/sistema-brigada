import { Controller, Get, Put, Body, UseGuards, BadRequestException } from '@nestjs/common';
import { CertificateTemplatesService } from './certificate-templates.service';
import { UpsertCertificateTemplateDto } from './dto/upsert-certificate-template.dto';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { RolesGuard } from '../auth/guard/roles.guard';
import { PermissionsGuard, RequirePermission } from '../auth/guard/permissions.guard';
import { Roles } from '../auth/decorator/roles.decorator';
import { Role } from '@prisma/client';
import { ActiveOrganizationId } from '../auth/common/active-organization-id.decorator';

@Controller('certificate-templates')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class CertificateTemplatesController {
    constructor(private readonly certificateTemplatesService: CertificateTemplatesService) {}

    private requireOrganizationId(organizationId: string | undefined): string {
        if (!organizationId) {
            throw new BadRequestException('Selecione uma organização ativa.');
        }
        return organizationId;
    }

    @Get()
    @Roles(Role.SUPER_ADMIN, Role.GROUP_ADMIN, Role.ORG_ADMIN, Role.ORG_USER)
    findOne(@ActiveOrganizationId() organizationId: string | undefined) {
        return this.certificateTemplatesService.findOne(this.requireOrganizationId(organizationId));
    }

    @Put()
    @RequirePermission('certificates:manage')
    upsert(@Body() dto: UpsertCertificateTemplateDto, @ActiveOrganizationId() organizationId: string | undefined) {
        return this.certificateTemplatesService.upsert(this.requireOrganizationId(organizationId), dto);
    }
}
