// backend/src/organizations/organizations.controller.ts
//
// Gestão de academias-clientes pela plataforma. Restrito a SUPER_ADMIN em
// todas as rotas (decisão 5 do docs/decisoes.md: onboarding manual, sem
// autocadastro). É o backend da tela `frontend/src/pages/admin/Organizations.tsx`.

import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query, HttpCode, HttpStatus, BadRequestException } from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { UpdateMyOrganizationDto } from './dto/update-my-organization.dto';
import { ListOrganizationsDto } from './dto/list-organizations.dto';
import { SendTestEmailDto } from '../email-templates/dto/send-test-email.dto';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { RolesGuard } from '../auth/guard/roles.guard';
import { Roles } from '../auth/decorator/roles.decorator';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/common/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { ActiveOrganizationId } from '../auth/common/active-organization-id.decorator';

@Controller('organizations')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN)
export class OrganizationsController {
    constructor(private readonly organizationsService: OrganizationsService) {}

    private requireOrganizationId(organizationId: string | undefined): string {
        if (!organizationId) {
            throw new BadRequestException('Nenhuma organização ativa para esta conta.');
        }
        return organizationId;
    }

    @Post()
    create(@Body() dto: CreateOrganizationDto) {
        return this.organizationsService.create(dto);
    }

    @Get()
    findAll(@Query() query: ListOrganizationsDto) {
        return this.organizationsService.findAll(query);
    }

    // Auto-edição da própria academia (aba "Academia" da central de
    // configurações). Rotas literais 'me' precisam vir ANTES de ':id' abaixo,
    // senão o Nest casa 'me' como valor de :id. @Roles aqui sobrescreve o
    // @Roles(SUPER_ADMIN) da classe (Reflector.getAllAndOverride prioriza o
    // metadado do método) — GROUP_ADMIN/ORG_ADMIN só enxergam a própria
    // organização porque usam @ActiveOrganizationId(), nunca um :id arbitrário.
    @Get('me')
    @Roles(Role.SUPER_ADMIN, Role.GROUP_ADMIN, Role.ORG_ADMIN)
    findMine(@ActiveOrganizationId() organizationId: string | undefined) {
        return this.organizationsService.findOne(this.requireOrganizationId(organizationId));
    }

    @Patch('me')
    @Roles(Role.SUPER_ADMIN, Role.GROUP_ADMIN, Role.ORG_ADMIN)
    updateMine(@Body() dto: UpdateMyOrganizationDto, @ActiveOrganizationId() organizationId: string | undefined) {
        return this.organizationsService.update(this.requireOrganizationId(organizationId), dto);
    }

    @Post('me/test-email')
    @Roles(Role.SUPER_ADMIN, Role.GROUP_ADMIN, Role.ORG_ADMIN)
    @HttpCode(HttpStatus.OK)
    sendTestEmail(@Body() dto: SendTestEmailDto, @ActiveOrganizationId() organizationId: string | undefined) {
        return this.organizationsService.sendTestEmail(this.requireOrganizationId(organizationId), dto.to);
    }

    // Só leitura: status de verificação dos domínios já cadastrados na conta Resend cuja
    // chave a academia colou (ver OrganizationsService.getResendDomainStatus).
    @Get('me/resend-domains')
    @Roles(Role.SUPER_ADMIN, Role.GROUP_ADMIN, Role.ORG_ADMIN)
    getResendDomains(@ActiveOrganizationId() organizationId: string | undefined) {
        return this.organizationsService.getResendDomainStatus(this.requireOrganizationId(organizationId));
    }

    // Troca o token do link público de autocadastro, invalidando o link já compartilhado
    // (ver OrganizationsService.regeneratePublicRegistrationToken).
    @Post('me/public-registration/regenerate-token')
    @Roles(Role.SUPER_ADMIN, Role.GROUP_ADMIN, Role.ORG_ADMIN)
    @HttpCode(HttpStatus.OK)
    regeneratePublicRegistrationToken(@ActiveOrganizationId() organizationId: string | undefined) {
        return this.organizationsService.regeneratePublicRegistrationToken(this.requireOrganizationId(organizationId));
    }

    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.organizationsService.findOne(id);
    }

    @Patch(':id')
    update(@Param('id') id: string, @Body() dto: UpdateOrganizationDto) {
        return this.organizationsService.update(id, dto);
    }

    @Delete(':id')
    remove(@Param('id') id: string) {
        return this.organizationsService.remove(id);
    }

    // Impersonação: SUPER_ADMIN "entra como" o ORG_ADMIN desta academia, sem
    // saber/precisar da senha dela (ver AuthService.impersonateOrganizationAdmin).
    @Post(':id/impersonate')
    @HttpCode(HttpStatus.OK)
    impersonate(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
        return this.organizationsService.impersonate(id, user);
    }
}
