import { Controller, Get, Post, Body, Param, UseGuards, Query, BadRequestException } from '@nestjs/common';
import { CertificatesService } from './certificates.service';
import { ListCertificatesDto } from './dto/list-certificates.dto';
import { IssueCertificateDto } from './dto/issue-certificate.dto';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { RolesGuard } from '../auth/guard/roles.guard';
import { PermissionsGuard, RequirePermission } from '../auth/guard/permissions.guard';
import { Roles } from '../auth/decorator/roles.decorator';
import { Role } from '@prisma/client';
import { ActiveOrganizationId } from '../auth/common/active-organization-id.decorator';
import { CurrentUser } from '../auth/common/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';

@Controller('certificates')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class CertificatesController {
    constructor(private readonly certificatesService: CertificatesService) {}

    private requireOrganizationId(organizationId: string | undefined): string {
        if (!organizationId) {
            throw new BadRequestException('Selecione uma organização ativa.');
        }
        return organizationId;
    }

    /** Fase 3 de posse de dado (docs/decisoes.md): listagem completa fica atrás de `certificates:manage` — o próprio aluno usa `GET /me/certificates`. */
    @Get()
    @RequirePermission('certificates:manage')
    findAll(@Query() query: ListCertificatesDto, @ActiveOrganizationId() organizationId: string | undefined) {
        return this.certificatesService.findAll(this.requireOrganizationId(organizationId), query);
    }

    @Get(':id')
    @Roles(Role.SUPER_ADMIN, Role.GROUP_ADMIN, Role.ORG_ADMIN, Role.ORG_USER)
    findOne(
        @Param('id') id: string,
        @ActiveOrganizationId() organizationId: string | undefined,
        @CurrentUser() user: AuthenticatedUser,
    ) {
        return this.certificatesService.findOneForRequester(id, this.requireOrganizationId(organizationId), user);
    }

    /** Emissão manual — normalmente a emissão é automática (decisão 16), isto é uma sobreposição administrativa. */
    @Post('issue')
    @RequirePermission('certificates:manage')
    issue(@Body() dto: IssueCertificateDto, @ActiveOrganizationId() organizationId: string | undefined) {
        return this.certificatesService.issueManually(dto.enrollmentId, this.requireOrganizationId(organizationId));
    }

    @Post(':id/regenerate-pdf')
    @RequirePermission('certificates:manage')
    regeneratePdf(@Param('id') id: string, @ActiveOrganizationId() organizationId: string | undefined) {
        return this.certificatesService.regeneratePdf(id, this.requireOrganizationId(organizationId));
    }
}
