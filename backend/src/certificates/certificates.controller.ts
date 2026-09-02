import { Controller, Get, Post, Body, Param, UseGuards, Query, BadRequestException } from '@nestjs/common';
import { CertificatesService } from './certificates.service';
import { ListCertificatesDto } from './dto/list-certificates.dto';
import { IssueCertificateDto } from './dto/issue-certificate.dto';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { RolesGuard } from '../auth/guard/roles.guard';
import { Roles } from '../auth/decorator/roles.decorator';
import { Role } from '@prisma/client';
import { ActiveOrganizationId } from '../auth/common/active-organization-id.decorator';

const ADMIN_ROLES = [Role.SUPER_ADMIN, Role.GROUP_ADMIN, Role.ORG_ADMIN] as const;

@Controller('certificates')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CertificatesController {
    constructor(private readonly certificatesService: CertificatesService) {}

    private requireOrganizationId(organizationId: string | undefined): string {
        if (!organizationId) {
            throw new BadRequestException('Selecione uma organização ativa.');
        }
        return organizationId;
    }

    @Get()
    @Roles(Role.SUPER_ADMIN, Role.GROUP_ADMIN, Role.ORG_ADMIN, Role.ORG_USER)
    findAll(@Query() query: ListCertificatesDto, @ActiveOrganizationId() organizationId: string | undefined) {
        return this.certificatesService.findAll(this.requireOrganizationId(organizationId), query);
    }

    @Get(':id')
    @Roles(Role.SUPER_ADMIN, Role.GROUP_ADMIN, Role.ORG_ADMIN, Role.ORG_USER)
    findOne(@Param('id') id: string, @ActiveOrganizationId() organizationId: string | undefined) {
        return this.certificatesService.findOne(id, this.requireOrganizationId(organizationId));
    }

    /** Emissão manual — normalmente a emissão é automática (decisão 16), isto é uma sobreposição administrativa. */
    @Post('issue')
    @Roles(...ADMIN_ROLES)
    issue(@Body() dto: IssueCertificateDto, @ActiveOrganizationId() organizationId: string | undefined) {
        return this.certificatesService.issueManually(dto.enrollmentId, this.requireOrganizationId(organizationId));
    }

    @Post(':id/regenerate-pdf')
    @Roles(...ADMIN_ROLES)
    regeneratePdf(@Param('id') id: string, @ActiveOrganizationId() organizationId: string | undefined) {
        return this.certificatesService.regeneratePdf(id, this.requireOrganizationId(organizationId));
    }
}
