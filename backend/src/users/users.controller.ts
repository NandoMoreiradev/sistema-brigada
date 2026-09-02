// backend/src/users/users.controller.ts
//
// Gestão de pessoas (alunos/instrutores/admins de unidade) na organização
// ativa. Restrito a papéis administrativos — é uma tela de gestão, não um
// autocadastro (decisão 5 do docs/decisoes.md).
//
// Leitura continua restrita a ADMIN_ROLES (não é aberta a ALL_ORG_ROLES —
// diferente de turmas/eventos, a listagem de pessoas expõe e-mail/telefone de
// todo mundo da organização, não é algo para deixar aberto por padrão).
// Escrita passa a usar `@RequirePermission('people:manage')` em vez de
// `@Roles`, para permitir delegar a uma pessoa sem ser ORG_ADMIN via cargo —
// ver backend/src/permissions/.

import { Controller, Get, Post, Body, Patch, Put, Param, UseGuards, Query, BadRequestException } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ListUsersDto } from './dto/list-users.dto';
import { SetRoleAssignmentDto } from './dto/set-role-assignment.dto';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { RolesGuard } from '../auth/guard/roles.guard';
import { PermissionsGuard, RequirePermission } from '../auth/guard/permissions.guard';
import { Roles } from '../auth/decorator/roles.decorator';
import { Role } from '@prisma/client';
import { ActiveOrganizationId } from '../auth/common/active-organization-id.decorator';

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
    @Roles(...ADMIN_ROLES)
    findAll(@Query() query: ListUsersDto, @ActiveOrganizationId() organizationId: string | undefined) {
        return this.usersService.findAll(this.requireOrganizationId(organizationId), query);
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
}
