// backend/src/registrations/registrations-admin.controller.ts
//
// Revisão (listar/aprovar/recusar) de solicitações de autocadastro público — permissão
// própria (registrations:manage), não people:manage, pra permitir delegar a revisão (ex:
// recepção) sem dar acesso total à tela de Alunos/Equipe. Mesmo shape de staff.controller.ts.

import { Controller, Get, Patch, Param, Body, Query, UseGuards, BadRequestException } from '@nestjs/common';
import { RegistrationsService } from './registrations.service';
import { ApproveRegistrationDto } from './dto/approve-registration.dto';
import { RejectRegistrationDto } from './dto/reject-registration.dto';
import { ListRegistrationsQueryDto } from './dto/list-registrations-query.dto';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { RolesGuard } from '../auth/guard/roles.guard';
import { PermissionsGuard, RequirePermission } from '../auth/guard/permissions.guard';
import { ActiveOrganizationId } from '../auth/common/active-organization-id.decorator';
import { CurrentUser } from '../auth/common/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';

@Controller('registrations')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class RegistrationsAdminController {
    constructor(private readonly registrationsService: RegistrationsService) {}

    private requireOrganizationId(organizationId: string | undefined): string {
        if (!organizationId) {
            throw new BadRequestException('Selecione uma organização ativa para revisar cadastros.');
        }
        return organizationId;
    }

    @Get()
    @RequirePermission('registrations:manage')
    findAll(@Query() query: ListRegistrationsQueryDto, @ActiveOrganizationId() organizationId: string | undefined) {
        return this.registrationsService.findAll(this.requireOrganizationId(organizationId), query);
    }

    @Get(':id')
    @RequirePermission('registrations:manage')
    findOne(@Param('id') id: string, @ActiveOrganizationId() organizationId: string | undefined) {
        return this.registrationsService.findOne(id, this.requireOrganizationId(organizationId));
    }

    @Patch(':id/approve')
    @RequirePermission('registrations:manage')
    approve(
        @Param('id') id: string,
        @Body() dto: ApproveRegistrationDto,
        @ActiveOrganizationId() organizationId: string | undefined,
        @CurrentUser() user: AuthenticatedUser,
    ) {
        return this.registrationsService.approve(id, this.requireOrganizationId(organizationId), user.id, dto);
    }

    @Patch(':id/reject')
    @RequirePermission('registrations:manage')
    reject(
        @Param('id') id: string,
        @Body() dto: RejectRegistrationDto,
        @ActiveOrganizationId() organizationId: string | undefined,
        @CurrentUser() user: AuthenticatedUser,
    ) {
        return this.registrationsService.reject(id, this.requireOrganizationId(organizationId), user.id, dto);
    }
}
