import { Controller, Get, Post, Body, Patch, Param, UseGuards, BadRequestException } from '@nestjs/common';
import { StaffService } from './staff.service';
import { PromoteStaffMemberDto } from './dto/promote-staff-member.dto';
import { UpdateStaffStatusDto } from './dto/update-staff-status.dto';
import { CreateExternalCertificationDto } from './dto/create-external-certification.dto';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { RolesGuard } from '../auth/guard/roles.guard';
import { Roles } from '../auth/decorator/roles.decorator';
import { Role } from '@prisma/client';
import { ActiveOrganizationId } from '../auth/common/active-organization-id.decorator';
import { CurrentUser } from '../auth/common/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';

const ADMIN_ROLES = [Role.SUPER_ADMIN, Role.GROUP_ADMIN, Role.ORG_ADMIN] as const;

@Controller('staff')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StaffController {
    constructor(private readonly staffService: StaffService) {}

    private requireOrganizationId(organizationId: string | undefined): string {
        if (!organizationId) {
            throw new BadRequestException('Selecione uma organização ativa para gerenciar a equipe.');
        }
        return organizationId;
    }

    @Post()
    @Roles(...ADMIN_ROLES)
    promote(
        @Body() dto: PromoteStaffMemberDto,
        @ActiveOrganizationId() organizationId: string | undefined,
        @CurrentUser() user: AuthenticatedUser,
    ) {
        return this.staffService.promote(dto.userId, this.requireOrganizationId(organizationId), user.id);
    }

    @Get()
    @Roles(Role.SUPER_ADMIN, Role.GROUP_ADMIN, Role.ORG_ADMIN, Role.ORG_USER)
    findAll(@ActiveOrganizationId() organizationId: string | undefined) {
        return this.staffService.findAll(this.requireOrganizationId(organizationId));
    }

    @Patch(':id/status')
    @Roles(...ADMIN_ROLES)
    updateStatus(
        @Param('id') id: string,
        @Body() dto: UpdateStaffStatusDto,
        @ActiveOrganizationId() organizationId: string | undefined,
    ) {
        return this.staffService.updateStatus(id, this.requireOrganizationId(organizationId), dto.status);
    }

    @Post(':id/external-certifications')
    @Roles(...ADMIN_ROLES)
    addExternalCertification(
        @Param('id') id: string,
        @Body() dto: CreateExternalCertificationDto,
        @ActiveOrganizationId() organizationId: string | undefined,
        @CurrentUser() user: AuthenticatedUser,
    ) {
        return this.staffService.addExternalCertification(id, this.requireOrganizationId(organizationId), user.id, dto);
    }
}
