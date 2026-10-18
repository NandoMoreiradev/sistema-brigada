import { Controller, Get, Post, Body, Patch, Delete, Param, UseGuards, BadRequestException } from '@nestjs/common';
import { StaffService } from './staff.service';
import { PromoteStaffMemberDto } from './dto/promote-staff-member.dto';
import { PromoteStaffMembersBulkDto } from './dto/promote-staff-members-bulk.dto';
import { UpdateStaffStatusDto } from './dto/update-staff-status.dto';
import { SetStaffMemberCategoryDto, StaffCategoryDto } from './dto/staff-category.dto';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { RolesGuard } from '../auth/guard/roles.guard';
import { PermissionsGuard, RequirePermission } from '../auth/guard/permissions.guard';
import { ActiveOrganizationId } from '../auth/common/active-organization-id.decorator';
import { CurrentUser } from '../auth/common/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';

@Controller('staff')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class StaffController {
    constructor(private readonly staffService: StaffService) {}

    private requireOrganizationId(organizationId: string | undefined): string {
        if (!organizationId) {
            throw new BadRequestException('Selecione uma organização ativa para gerenciar a equipe.');
        }
        return organizationId;
    }

    @Post()
    @RequirePermission('staff:manage')
    promote(
        @Body() dto: PromoteStaffMemberDto,
        @ActiveOrganizationId() organizationId: string | undefined,
        @CurrentUser() user: AuthenticatedUser,
    ) {
        return this.staffService.promote(dto.userId, this.requireOrganizationId(organizationId), user.id, dto.categoryId);
    }

    @Post('bulk')
    @RequirePermission('staff:manage')
    promoteMany(
        @Body() dto: PromoteStaffMembersBulkDto,
        @ActiveOrganizationId() organizationId: string | undefined,
        @CurrentUser() user: AuthenticatedUser,
    ) {
        return this.staffService.promoteMany(dto.userIds, this.requireOrganizationId(organizationId), user.id, dto.categoryId);
    }

    /**
     * Fase 3 de posse de dado (docs/decisoes.md): a listagem completa da
     * equipe fica atrás de `staff:manage` — quem só quer ver a própria
     * designação usa `GET /me/designations`, não esta lista.
     */
    @Get()
    @RequirePermission('staff:manage')
    findAll(@ActiveOrganizationId() organizationId: string | undefined) {
        return this.staffService.findAll(this.requireOrganizationId(organizationId));
    }

    /* Catálogo de categorias (decisão 78). Rotas fixas, sem conflito com `:id/...` abaixo. */

    @Get('categories')
    @RequirePermission('staff:manage')
    listCategories(@ActiveOrganizationId() organizationId: string | undefined) {
        return this.staffService.listCategories(this.requireOrganizationId(organizationId));
    }

    @Post('categories')
    @RequirePermission('staff:manage')
    createCategory(@Body() dto: StaffCategoryDto, @ActiveOrganizationId() organizationId: string | undefined) {
        return this.staffService.createCategory(this.requireOrganizationId(organizationId), dto.name);
    }

    @Patch('categories/:id')
    @RequirePermission('staff:manage')
    updateCategory(@Param('id') id: string, @Body() dto: StaffCategoryDto, @ActiveOrganizationId() organizationId: string | undefined) {
        return this.staffService.updateCategory(id, this.requireOrganizationId(organizationId), dto.name);
    }

    @Delete('categories/:id')
    @RequirePermission('staff:manage')
    removeCategory(@Param('id') id: string, @ActiveOrganizationId() organizationId: string | undefined) {
        return this.staffService.removeCategory(id, this.requireOrganizationId(organizationId));
    }

    @Patch(':id/status')
    @RequirePermission('staff:manage')
    updateStatus(
        @Param('id') id: string,
        @Body() dto: UpdateStaffStatusDto,
        @ActiveOrganizationId() organizationId: string | undefined,
    ) {
        return this.staffService.updateStatus(id, this.requireOrganizationId(organizationId), dto.status);
    }

    @Patch(':id/category')
    @RequirePermission('staff:manage')
    setCategory(
        @Param('id') id: string,
        @Body() dto: SetStaffMemberCategoryDto,
        @ActiveOrganizationId() organizationId: string | undefined,
    ) {
        return this.staffService.setCategory(id, this.requireOrganizationId(organizationId), dto.categoryId);
    }
}
