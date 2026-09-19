// backend/src/email-templates/email-templates.controller.ts
//
// Padrão idêntico ao de certificate-templates.controller.ts: SUPER_ADMIN sem organização
// ativa edita os padrões globais; ORG_ADMIN (e SUPER_ADMIN com uma organização ativa
// selecionada) só enxerga/edita o override da própria academia — ver ActiveOrganizationId.

import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { EmailTemplatesService } from './email-templates.service';
import { CreateEmailTemplateDto } from './dto/create-email-template.dto';
import { UpdateEmailTemplateDto } from './dto/update-email-template.dto';
import { SendTestEmailDto } from './dto/send-test-email.dto';
import { FindEmailTemplatesQueryDto } from './dto/find-email-templates-query.dto';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { RolesGuard } from '../auth/guard/roles.guard';
import { Roles } from '../auth/decorator/roles.decorator';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/common/current-user.decorator';
import { ActiveOrganizationId } from '../auth/common/active-organization-id.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';

@Controller('email-templates')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN, Role.GROUP_ADMIN, Role.ORG_ADMIN)
export class EmailTemplatesController {
    constructor(private readonly emailTemplatesService: EmailTemplatesService) {}

    @Get()
    findAll(@CurrentUser() user: AuthenticatedUser, @Query() query: FindEmailTemplatesQueryDto, @ActiveOrganizationId() activeOrganizationId?: string) {
        return this.emailTemplatesService.findAll(user, query, activeOrganizationId);
    }

    @Get('triggers')
    getTriggers() {
        return this.emailTemplatesService.getAvailableTriggers();
    }

    @Get('merge-tags')
    getMergeTags() {
        return this.emailTemplatesService.getAvailableMergeTags();
    }

    @Get(':id')
    findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser, @ActiveOrganizationId() activeOrganizationId?: string) {
        return this.emailTemplatesService.findOne(id, user, activeOrganizationId);
    }

    @Post()
    create(@Body() dto: CreateEmailTemplateDto, @CurrentUser() user: AuthenticatedUser, @ActiveOrganizationId() activeOrganizationId?: string) {
        return this.emailTemplatesService.create(dto, user, activeOrganizationId);
    }

    @Patch(':id')
    update(
        @Param('id') id: string,
        @Body() dto: UpdateEmailTemplateDto,
        @CurrentUser() user: AuthenticatedUser,
        @ActiveOrganizationId() activeOrganizationId?: string,
    ) {
        return this.emailTemplatesService.update(id, dto, user, activeOrganizationId);
    }

    @Delete(':id')
    remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser, @ActiveOrganizationId() activeOrganizationId?: string) {
        return this.emailTemplatesService.remove(id, user, activeOrganizationId);
    }

    @Post(':id/send-test')
    @HttpCode(HttpStatus.OK)
    sendTestEmail(
        @Param('id') id: string,
        @Body() dto: SendTestEmailDto,
        @CurrentUser() user: AuthenticatedUser,
        @ActiveOrganizationId() activeOrganizationId?: string,
    ) {
        return this.emailTemplatesService.sendTestEmail(id, dto.to, user, activeOrganizationId);
    }
}
