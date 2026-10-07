import { Controller, Get, Put, Post, Body, Param, UseGuards, BadRequestException } from '@nestjs/common';
import { CertificateRemindersService } from './certificate-reminders.service';
import { CertificateReminderSettingsDto } from './dto/certificate-reminder-settings.dto';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { RolesGuard } from '../auth/guard/roles.guard';
import { PermissionsGuard, RequirePermission } from '../auth/guard/permissions.guard';
import { ActiveOrganizationId } from '../auth/common/active-organization-id.decorator';
import { CurrentUser } from '../auth/common/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';

/** Lembretes de vencimento: configuração da academia, pré-visualização, histórico e envio manual. */
@Controller('certificate-reminders')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@RequirePermission('certificates:manage')
export class CertificateRemindersController {
    constructor(private readonly certificateRemindersService: CertificateRemindersService) {}

    private requireOrganizationId(organizationId: string | undefined): string {
        if (!organizationId) {
            throw new BadRequestException('Selecione uma organização ativa.');
        }
        return organizationId;
    }

    @Get('settings')
    getSettings(@ActiveOrganizationId() organizationId: string | undefined) {
        return this.certificateRemindersService.getSettings(this.requireOrganizationId(organizationId));
    }

    @Put('settings')
    saveSettings(@Body() dto: CertificateReminderSettingsDto, @ActiveOrganizationId() organizationId: string | undefined) {
        return this.certificateRemindersService.saveSettings(this.requireOrganizationId(organizationId), dto);
    }

    /** Recebe a configuração ainda não salva e mostra o que ela enviaria nos próximos 30 dias. */
    @Post('preview')
    preview(@Body() dto: CertificateReminderSettingsDto, @ActiveOrganizationId() organizationId: string | undefined) {
        return this.certificateRemindersService.preview(this.requireOrganizationId(organizationId), dto);
    }

    @Get('certificates/:certificateId')
    listForCertificate(@Param('certificateId') certificateId: string, @ActiveOrganizationId() organizationId: string | undefined) {
        return this.certificateRemindersService.listForCertificate(certificateId, this.requireOrganizationId(organizationId));
    }

    @Post('certificates/:certificateId/send')
    sendManually(
        @Param('certificateId') certificateId: string,
        @ActiveOrganizationId() organizationId: string | undefined,
        @CurrentUser() user: AuthenticatedUser,
    ) {
        return this.certificateRemindersService.sendManually(certificateId, this.requireOrganizationId(organizationId), user.id);
    }
}
