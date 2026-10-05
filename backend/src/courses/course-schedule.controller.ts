// backend/src/courses/course-schedule.controller.ts
//
// Programação da turma: grupos, atividades, dia de cada grupo e modelos (ver
// course-schedule.service.ts). Montar a programação é gestão (`courses:manage`); ler é aberto a
// quem faz parte da turma (o service recorta o que o aluno vê).

import { Controller, Get, Post, Put, Patch, Delete, Body, Param, UseGuards, BadRequestException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CourseScheduleService } from './course-schedule.service';
import {
    ApplyTemplateDto,
    AssignGroupsDto,
    CreateActivityDto,
    CreateGroupDto,
    SaveScheduleDayDto,
    SaveTemplateDto,
    UpdateActivityDto,
    UpdateGroupDto,
} from './dto/course-schedule.dto';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { RolesGuard } from '../auth/guard/roles.guard';
import { PermissionsGuard, RequirePermission } from '../auth/guard/permissions.guard';
import { Roles } from '../auth/decorator/roles.decorator';
import { ActiveOrganizationId } from '../auth/common/active-organization-id.decorator';
import { CurrentUser } from '../auth/common/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';

const ALL_ORG_ROLES = [Role.SUPER_ADMIN, Role.GROUP_ADMIN, Role.ORG_ADMIN, Role.ORG_USER] as const;

function requireOrganizationId(organizationId: string | undefined): string {
    if (!organizationId) {
        throw new BadRequestException('Selecione uma organização ativa.');
    }
    return organizationId;
}

@Controller('courses/:courseId')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class CourseScheduleController {
    constructor(private readonly scheduleService: CourseScheduleService) {}

    @Get('schedule')
    @Roles(...ALL_ORG_ROLES)
    getSchedule(@Param('courseId') courseId: string, @ActiveOrganizationId() organizationId: string | undefined, @CurrentUser() user: AuthenticatedUser) {
        return this.scheduleService.getSchedule(courseId, requireOrganizationId(organizationId), user);
    }

    @Put('schedule/day')
    @RequirePermission('courses:manage')
    saveDay(@Param('courseId') courseId: string, @Body() dto: SaveScheduleDayDto, @ActiveOrganizationId() organizationId: string | undefined) {
        return this.scheduleService.saveDay(courseId, requireOrganizationId(organizationId), dto);
    }

    @Post('schedule/template')
    @RequirePermission('courses:manage')
    saveTemplate(@Param('courseId') courseId: string, @Body() dto: SaveTemplateDto, @ActiveOrganizationId() organizationId: string | undefined) {
        return this.scheduleService.saveTemplate(courseId, requireOrganizationId(organizationId), dto.name);
    }

    @Post('schedule/apply-template')
    @RequirePermission('courses:manage')
    applyTemplate(@Param('courseId') courseId: string, @Body() dto: ApplyTemplateDto, @ActiveOrganizationId() organizationId: string | undefined) {
        return this.scheduleService.applyTemplate(courseId, requireOrganizationId(organizationId), dto);
    }

    @Post('groups')
    @RequirePermission('courses:manage')
    createGroup(@Param('courseId') courseId: string, @Body() dto: CreateGroupDto, @ActiveOrganizationId() organizationId: string | undefined) {
        return this.scheduleService.createGroup(courseId, requireOrganizationId(organizationId), dto);
    }

    @Put('groups/assignments')
    @RequirePermission('courses:manage')
    assignGroups(@Param('courseId') courseId: string, @Body() dto: AssignGroupsDto, @ActiveOrganizationId() organizationId: string | undefined) {
        return this.scheduleService.assignGroups(courseId, requireOrganizationId(organizationId), dto);
    }

    @Patch('groups/:groupId')
    @RequirePermission('courses:manage')
    updateGroup(
        @Param('courseId') courseId: string,
        @Param('groupId') groupId: string,
        @Body() dto: UpdateGroupDto,
        @ActiveOrganizationId() organizationId: string | undefined,
    ) {
        return this.scheduleService.updateGroup(courseId, requireOrganizationId(organizationId), groupId, dto);
    }

    @Delete('groups/:groupId')
    @RequirePermission('courses:manage')
    removeGroup(@Param('courseId') courseId: string, @Param('groupId') groupId: string, @ActiveOrganizationId() organizationId: string | undefined) {
        return this.scheduleService.removeGroup(courseId, requireOrganizationId(organizationId), groupId);
    }

    @Post('activities')
    @RequirePermission('courses:manage')
    createActivity(@Param('courseId') courseId: string, @Body() dto: CreateActivityDto, @ActiveOrganizationId() organizationId: string | undefined) {
        return this.scheduleService.createActivity(courseId, requireOrganizationId(organizationId), dto);
    }

    @Patch('activities/:activityId')
    @RequirePermission('courses:manage')
    updateActivity(
        @Param('courseId') courseId: string,
        @Param('activityId') activityId: string,
        @Body() dto: UpdateActivityDto,
        @ActiveOrganizationId() organizationId: string | undefined,
    ) {
        return this.scheduleService.updateActivity(courseId, requireOrganizationId(organizationId), activityId, dto);
    }

    @Delete('activities/:activityId')
    @RequirePermission('courses:manage')
    removeActivity(@Param('courseId') courseId: string, @Param('activityId') activityId: string, @ActiveOrganizationId() organizationId: string | undefined) {
        return this.scheduleService.removeActivity(courseId, requireOrganizationId(organizationId), activityId);
    }
}

@Controller('schedule-templates')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class ScheduleTemplatesController {
    constructor(private readonly scheduleService: CourseScheduleService) {}

    @Get()
    @RequirePermission('courses:manage')
    list(@ActiveOrganizationId() organizationId: string | undefined) {
        return this.scheduleService.listTemplates(requireOrganizationId(organizationId));
    }

    @Delete(':id')
    @RequirePermission('courses:manage')
    remove(@Param('id') id: string, @ActiveOrganizationId() organizationId: string | undefined) {
        return this.scheduleService.removeTemplate(id, requireOrganizationId(organizationId));
    }
}
