import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, BadRequestException } from '@nestjs/common';
import { RoleAssignmentsService } from './role-assignments.service';
import { CreateRoleAssignmentDto } from './dto/create-role-assignment.dto';
import { UpdateRoleAssignmentDto } from './dto/update-role-assignment.dto';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { RolesGuard } from '../auth/guard/roles.guard';
import { Roles } from '../auth/decorator/roles.decorator';
import { Role } from '@prisma/client';
import { ActiveOrganizationId } from '../auth/common/active-organization-id.decorator';

@Controller('role-assignments')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN, Role.GROUP_ADMIN, Role.ORG_ADMIN)
export class RoleAssignmentsController {
    constructor(private readonly roleAssignmentsService: RoleAssignmentsService) {}

    private requireOrganizationId(organizationId: string | undefined): string {
        if (!organizationId) {
            throw new BadRequestException('Selecione uma organização ativa para gerenciar cargos.');
        }
        return organizationId;
    }

    @Post()
    create(@Body() dto: CreateRoleAssignmentDto, @ActiveOrganizationId() organizationId: string | undefined) {
        return this.roleAssignmentsService.create(this.requireOrganizationId(organizationId), dto);
    }

    @Get()
    findAll(@ActiveOrganizationId() organizationId: string | undefined) {
        return this.roleAssignmentsService.findAll(this.requireOrganizationId(organizationId));
    }

    @Patch(':id')
    update(
        @Param('id') id: string,
        @Body() dto: UpdateRoleAssignmentDto,
        @ActiveOrganizationId() organizationId: string | undefined,
    ) {
        return this.roleAssignmentsService.update(id, this.requireOrganizationId(organizationId), dto);
    }

    @Delete(':id')
    remove(@Param('id') id: string, @ActiveOrganizationId() organizationId: string | undefined) {
        return this.roleAssignmentsService.remove(id, this.requireOrganizationId(organizationId));
    }
}
