// backend/src/users/users.controller.ts
//
// Gestão de pessoas (alunos/instrutores/admins de unidade) na organização
// ativa. Restrito a papéis administrativos — é uma tela de gestão, não um
// autocadastro (decisão 5 do docs/decisoes.md).
//
// Leitura da listagem (`findAll`) também usa `@RequirePermission('people:manage')`
// (Fase 3 de posse de dado, docs/decisoes.md) — igual à escrita, para que um
// cargo delegado (secretaria/coordenador) veja a lista sem precisar ser
// ORG_ADMIN. `findOne` de uma pessoa específica continua restrito a
// ADMIN_ROLES sem mudança.

import { Controller, Get, Post, Body, Patch, Put, Param, UseGuards, Query, BadRequestException } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ListUsersDto } from './dto/list-users.dto';
import { SetRoleAssignmentDto } from './dto/set-role-assignment.dto';
import { SetDirectPermissionsDto } from './dto/set-direct-permissions.dto';
import { CreateExternalCertificationDto } from './dto/create-external-certification.dto';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { RolesGuard } from '../auth/guard/roles.guard';
import { PermissionsGuard, RequirePermission } from '../auth/guard/permissions.guard';
import { Roles } from '../auth/decorator/roles.decorator';
import { Role } from '@prisma/client';
import { ActiveOrganizationId } from '../auth/common/active-organization-id.decorator';
import { CurrentUser } from '../auth/common/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';

const ADMIN_ROLES = [Role.SUPER_ADMIN, Role.GROUP_ADMIN, Role.ORG_ADMIN] as const;

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class UsersController {
    constructor(private readonly usersService: UsersService) {}

    private requireOrganizationId(organizationId: string | undefined): string {
        if (!organizationId) {
            throw new BadRequestException('Selecione uma organização ativa para gerenciar pessoas.');
        }
        return organizationId;
    }

    @Post()
    @RequirePermission('people:manage')
    create(@Body() dto: CreateUserDto, @ActiveOrganizationId() organizationId: string | undefined) {
        return this.usersService.create(dto, this.requireOrganizationId(organizationId));
    }

    @Get()
    @RequirePermission('people:manage')
    findAll(@Query() query: ListUsersDto, @ActiveOrganizationId() organizationId: string | undefined) {
        return this.usersService.findAll(this.requireOrganizationId(organizationId), query);
    }

    /**
     * Sem @Roles/@RequirePermission de propósito — aberto a qualquer autenticado
     * (RolesGuard/PermissionsGuard não bloqueiam rota sem esses decorators). Só
     * id+nome (ver UsersService.findRoster), para seletores de pessoa em
     * funcionalidades abertas a todo mundo (hoje: marcar presença de reunião,
     * meetings.service.ts). Declarada antes de `:id` para não colidir com ela.
     */
    @Get('roster')
    roster(@ActiveOrganizationId() organizationId: string | undefined) {
        return this.usersService.findRoster(this.requireOrganizationId(organizationId));
    }

    @Get(':id')
    @Roles(...ADMIN_ROLES)
    findOne(@Param('id') id: string, @ActiveOrganizationId() organizationId: string | undefined) {
        return this.usersService.findOne(id, this.requireOrganizationId(organizationId));
    }

    @Patch(':id')
    @RequirePermission('people:manage')
    update(
        @Param('id') id: string,
        @Body() dto: UpdateUserDto,
        @ActiveOrganizationId() organizationId: string | undefined,
    ) {
        return this.usersService.update(id, this.requireOrganizationId(organizationId), dto);
    }

    @Put(':id/role-assignment')
    @RequirePermission('people:manage')
    setRoleAssignment(
        @Param('id') id: string,
        @Body() dto: SetRoleAssignmentDto,
        @ActiveOrganizationId() organizationId: string | undefined,
    ) {
        return this.usersService.setRoleAssignment(id, this.requireOrganizationId(organizationId), dto.roleAssignmentId ?? null);
    }

    @Put(':id/direct-permissions')
    @RequirePermission('people:manage')
    setDirectPermissions(
        @Param('id') id: string,
        @Body() dto: SetDirectPermissionsDto,
        @ActiveOrganizationId() organizationId: string | undefined,
    ) {
        return this.usersService.setDirectPermissions(id, this.requireOrganizationId(organizationId), dto.permissionIds);
    }

    /**
     * Decisão 32 do docs/decisoes.md: certificação/qualificação prévia é um
     * fato sobre a pessoa, não sobre um papel específico (staff/instrutor) —
     * por isso mora aqui, em `users`, e não em `staff`.
     */
    @Post(':id/external-certifications')
    @RequirePermission('people:manage')
    addExternalCertification(
        @Param('id') id: string,
        @Body() dto: CreateExternalCertificationDto,
        @ActiveOrganizationId() organizationId: string | undefined,
        @CurrentUser() user: AuthenticatedUser,
    ) {
        return this.usersService.addExternalCertification(id, this.requireOrganizationId(organizationId), user.id, dto);
    }
}
