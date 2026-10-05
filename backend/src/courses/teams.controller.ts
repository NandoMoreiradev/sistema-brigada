// backend/src/courses/teams.controller.ts
//
// Sem DELETE: equipe usada em programação antiga só é desativada (`active: false` via PATCH).

import { Controller, Get, Post, Body, Patch, Param, UseGuards, BadRequestException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { TeamsService } from './teams.service';
import { CreateTeamDto, UpdateTeamDto } from './dto/team.dto';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { RolesGuard } from '../auth/guard/roles.guard';
import { PermissionsGuard, RequirePermission } from '../auth/guard/permissions.guard';
import { Roles } from '../auth/decorator/roles.decorator';
import { ActiveOrganizationId } from '../auth/common/active-organization-id.decorator';

@Controller('teams')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class TeamsController {
    constructor(private readonly teamsService: TeamsService) {}

    private requireOrganizationId(organizationId: string | undefined): string {
        if (!organizationId) {
            throw new BadRequestException('Selecione uma organização ativa para gerenciar equipes.');
        }
        return organizationId;
    }

    @Get()
    @Roles(Role.SUPER_ADMIN, Role.GROUP_ADMIN, Role.ORG_ADMIN, Role.ORG_USER)
    findAll(@ActiveOrganizationId() organizationId: string | undefined) {
        return this.teamsService.findAll(this.requireOrganizationId(organizationId));
    }

    @Post()
    @RequirePermission('courses:manage')
    create(@Body() dto: CreateTeamDto, @ActiveOrganizationId() organizationId: string | undefined) {
        return this.teamsService.create(dto, this.requireOrganizationId(organizationId));
    }

    @Patch(':id')
    @RequirePermission('courses:manage')
    update(@Param('id') id: string, @Body() dto: UpdateTeamDto, @ActiveOrganizationId() organizationId: string | undefined) {
        return this.teamsService.update(id, this.requireOrganizationId(organizationId), dto);
    }
}
