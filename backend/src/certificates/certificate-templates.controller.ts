import { Controller, Get, Put, Post, Body, UseGuards, BadRequestException, StreamableFile, Header, HttpCode } from '@nestjs/common';
import { CertificateTemplatesService } from './certificate-templates.service';
import { UpsertCertificateTemplateDto } from './dto/upsert-certificate-template.dto';
import { PreviewCertificateDto } from './dto/preview-certificate.dto';
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

    /** Variáveis que os textos do certificado aceitam ({{aluno.nome}}...). */
    @Get('variables')
    @RequirePermission('certificates:manage')
    variables() {
        return this.certificateTemplatesService.getVariables();
    }

    /** Modelos prontos (Clássico, Moderno, Elegante) para começar no editor. */
    @Get('presets')
    @RequirePermission('certificates:manage')
    presets() {
        return this.certificateTemplatesService.getPresets();
    }

    /** PDF de exemplo com o layout informado (ainda não salvo) ou o salvo. */
    @Post('preview')
    @HttpCode(200)
    @RequirePermission('certificates:manage')
    @Header('Content-Type', 'application/pdf')
    @Header('Content-Disposition', 'inline; filename="certificado-exemplo.pdf"')
    async preview(@Body() dto: PreviewCertificateDto, @ActiveOrganizationId() organizationId: string | undefined) {
        const pdf = await this.certificateTemplatesService.preview(this.requireOrganizationId(organizationId), dto);
        return new StreamableFile(pdf);
    }
}
