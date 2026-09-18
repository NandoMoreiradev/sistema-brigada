import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, BadRequestException } from '@nestjs/common';
import { CourseModulesService } from './course-modules.service';
import { CreateCourseModuleDto } from './dto/create-course-module.dto';
import { UpdateCourseModuleDto } from './dto/update-course-module.dto';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { RolesGuard } from '../auth/guard/roles.guard';
import { PermissionsGuard, RequirePermission } from '../auth/guard/permissions.guard';
import { Roles } from '../auth/decorator/roles.decorator';
import { Role } from '@prisma/client';
import { ActiveOrganizationId } from '../auth/common/active-organization-id.decorator';
import { CurrentUser } from '../auth/common/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';

const ALL_ORG_ROLES = [Role.SUPER_ADMIN, Role.GROUP_ADMIN, Role.ORG_ADMIN, Role.ORG_USER] as const;

@Controller('courses/:courseId/modules')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class CourseModulesController {
    constructor(private readonly courseModulesService: CourseModulesService) {}

    private requireOrganizationId(organizationId: string | undefined): string {
        if (!organizationId) {
            throw new BadRequestException('Selecione uma organização ativa.');
        }
        return organizationId;
    }

    @Post()
    @RequirePermission('courses:manage')
    create(
        @Param('courseId') courseId: string,
        @Body() dto: CreateCourseModuleDto,
        @ActiveOrganizationId() organizationId: string | undefined,
    ) {
        return this.courseModulesService.create(courseId, this.requireOrganizationId(organizationId), dto);
    }

    @Get()
    @Roles(...ALL_ORG_ROLES)
    findAll(
        @Param('courseId') courseId: string,
        @ActiveOrganizationId() organizationId: string | undefined,
        @CurrentUser() user: AuthenticatedUser,
    ) {
        return this.courseModulesService.findAll(courseId, this.requireOrganizationId(organizationId), user.id);
    }

    @Patch(':moduleId')
    @RequirePermission('courses:manage')
    update(
        @Param('courseId') courseId: string,
        @Param('moduleId') moduleId: string,
        @Body() dto: UpdateCourseModuleDto,
        @ActiveOrganizationId() organizationId: string | undefined,
    ) {
        return this.courseModulesService.update(courseId, this.requireOrganizationId(organizationId), moduleId, dto);
    }

    @Delete(':moduleId')
    @RequirePermission('courses:manage')
    remove(
        @Param('courseId') courseId: string,
        @Param('moduleId') moduleId: string,
        @ActiveOrganizationId() organizationId: string | undefined,
    ) {
        return this.courseModulesService.remove(courseId, this.requireOrganizationId(organizationId), moduleId);
    }
}
