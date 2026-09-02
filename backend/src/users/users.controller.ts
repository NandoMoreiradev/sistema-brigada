// backend/src/users/users.controller.ts
//
// Gestão de pessoas (alunos/instrutores/admins de unidade) na organização
// ativa. Restrito a papéis administrativos — é uma tela de gestão, não um
// autocadastro (decisão 5 do docs/decisoes.md).

import { Controller, Get, Post, Body, Patch, Param, UseGuards, Query, BadRequestException } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ListUsersDto } from './dto/list-users.dto';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { RolesGuard } from '../auth/guard/roles.guard';
import { Roles } from '../auth/decorator/roles.decorator';
import { Role } from '@prisma/client';
import { ActiveOrganizationId } from '../auth/common/active-organization-id.decorator';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN, Role.GROUP_ADMIN, Role.ORG_ADMIN)
export class UsersController {
    constructor(private readonly usersService: UsersService) {}

    private requireOrganizationId(organizationId: string | undefined): string {
        if (!organizationId) {
            throw new BadRequestException('Selecione uma organização ativa para gerenciar pessoas.');
        }
        return organizationId;
    }

    @Post()
    create(@Body() dto: CreateUserDto, @ActiveOrganizationId() organizationId: string | undefined) {
        return this.usersService.create(dto, this.requireOrganizationId(organizationId));
    }

    @Get()
    findAll(@Query() query: ListUsersDto, @ActiveOrganizationId() organizationId: string | undefined) {
        return this.usersService.findAll(this.requireOrganizationId(organizationId), query);
    }

    @Get(':id')
    findOne(@Param('id') id: string, @ActiveOrganizationId() organizationId: string | undefined) {
        return this.usersService.findOne(id, this.requireOrganizationId(organizationId));
    }

    @Patch(':id')
    update(
        @Param('id') id: string,
        @Body() dto: UpdateUserDto,
        @ActiveOrganizationId() organizationId: string | undefined,
    ) {
        return this.usersService.update(id, this.requireOrganizationId(organizationId), dto);
    }
}
