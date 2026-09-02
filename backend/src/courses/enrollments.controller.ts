import { Controller, Get, Post, Body, Patch, Param, UseGuards, BadRequestException } from '@nestjs/common';
import { EnrollmentsService } from './enrollments.service';
import { CreateEnrollmentDto } from './dto/create-enrollment.dto';
import { UpdateEnrollmentDto } from './dto/update-enrollment.dto';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { RolesGuard } from '../auth/guard/roles.guard';
import { PermissionsGuard, RequirePermission } from '../auth/guard/permissions.guard';
import { Roles } from '../auth/decorator/roles.decorator';
import { Role } from '@prisma/client';
import { ActiveOrganizationId } from '../auth/common/active-organization-id.decorator';

const ALL_ORG_ROLES = [Role.SUPER_ADMIN, Role.GROUP_ADMIN, Role.ORG_ADMIN, Role.ORG_USER] as const;

@Controller('courses/:courseId/enrollments')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class EnrollmentsController {
    constructor(private readonly enrollmentsService: EnrollmentsService) {}

    private requireOrganizationId(organizationId: string | undefined): string {
        if (!organizationId) {
            throw new BadRequestException('Selecione uma organização ativa para gerenciar matrículas.');
        }
        return organizationId;
    }

    @Post()
    @RequirePermission('courses:manage')
    enroll(
        @Param('courseId') courseId: string,
        @Body() dto: CreateEnrollmentDto,
        @ActiveOrganizationId() organizationId: string | undefined,
    ) {
        return this.enrollmentsService.enroll(courseId, this.requireOrganizationId(organizationId), dto.userId);
    }

    @Get()
    @Roles(...ALL_ORG_ROLES)
    findAll(@Param('courseId') courseId: string, @ActiveOrganizationId() organizationId: string | undefined) {
        return this.enrollmentsService.findAll(courseId, this.requireOrganizationId(organizationId));
    }

    @Patch(':enrollmentId')
    @RequirePermission('courses:manage')
    updateStatus(
        @Param('courseId') courseId: string,
        @Param('enrollmentId') enrollmentId: string,
        @Body() dto: UpdateEnrollmentDto,
        @ActiveOrganizationId() organizationId: string | undefined,
    ) {
        return this.enrollmentsService.updateStatus(courseId, this.requireOrganizationId(organizationId), enrollmentId, dto);
    }
}
