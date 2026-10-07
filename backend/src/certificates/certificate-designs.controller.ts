import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, BadRequestException } from '@nestjs/common';
import { CertificateDesignsService } from './certificate-designs.service';
import { CreateCertificateDesignDto, UpdateCertificateDesignDto } from './dto/certificate-design.dto';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { RolesGuard } from '../auth/guard/roles.guard';
import { PermissionsGuard, RequirePermission } from '../auth/guard/permissions.guard';
import { ActiveOrganizationId } from '../auth/common/active-organization-id.decorator';

/** Modelos de certificado da academia (vários; um é o padrão; a turma pode escolher outro). */
@Controller('certificate-designs')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@RequirePermission('certificates:manage')
export class CertificateDesignsController {
    constructor(private readonly designsService: CertificateDesignsService) {}

    private requireOrganizationId(organizationId: string | undefined): string {
        if (!organizationId) {
            throw new BadRequestException('Selecione uma organização ativa.');
        }
        return organizationId;
    }

    @Get()
    list(@ActiveOrganizationId() organizationId: string | undefined) {
        return this.designsService.list(this.requireOrganizationId(organizationId));
    }

    @Get(':id')
    findOne(@Param('id') id: string, @ActiveOrganizationId() organizationId: string | undefined) {
        return this.designsService.findOne(id, this.requireOrganizationId(organizationId));
    }

    @Post()
    create(@Body() dto: CreateCertificateDesignDto, @ActiveOrganizationId() organizationId: string | undefined) {
        return this.designsService.create(this.requireOrganizationId(organizationId), dto);
    }

    @Put(':id')
    update(@Param('id') id: string, @Body() dto: UpdateCertificateDesignDto, @ActiveOrganizationId() organizationId: string | undefined) {
        return this.designsService.update(id, this.requireOrganizationId(organizationId), dto);
    }

    @Post(':id/default')
    setDefault(@Param('id') id: string, @ActiveOrganizationId() organizationId: string | undefined) {
        return this.designsService.setDefault(id, this.requireOrganizationId(organizationId));
    }

    @Delete(':id')
    remove(@Param('id') id: string, @ActiveOrganizationId() organizationId: string | undefined) {
        return this.designsService.remove(id, this.requireOrganizationId(organizationId));
    }
}
