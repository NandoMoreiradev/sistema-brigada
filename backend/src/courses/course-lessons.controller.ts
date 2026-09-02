// backend/src/courses/course-lessons.controller.ts
//
// Create/update de aula liberado a qualquer papel autenticado da organização
// (instrutor é um ORG_USER comum, decisão de produto de manter o RBAC simples
// até o sistema de permissões granulares ser populado — ver comentário
// equivalente em class-sessions.controller.ts). Marcar progresso é sempre
// sobre o próprio usuário autenticado.

import { Controller, Post, Body, Patch, Put, Param, Delete, UseGuards, BadRequestException } from '@nestjs/common';
import { CourseLessonsService } from './course-lessons.service';
import { CreateCourseLessonDto } from './dto/create-course-lesson.dto';
import { UpdateCourseLessonDto } from './dto/update-course-lesson.dto';
import { UpdateLessonProgressDto } from './dto/update-lesson-progress.dto';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { RolesGuard } from '../auth/guard/roles.guard';
import { Roles } from '../auth/decorator/roles.decorator';
import { Role } from '@prisma/client';
import { ActiveOrganizationId } from '../auth/common/active-organization-id.decorator';
import { CurrentUser } from '../auth/common/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';

const ADMIN_ROLES = [Role.SUPER_ADMIN, Role.GROUP_ADMIN, Role.ORG_ADMIN] as const;
const ALL_ORG_ROLES = [Role.SUPER_ADMIN, Role.GROUP_ADMIN, Role.ORG_ADMIN, Role.ORG_USER] as const;

@Controller('courses/:courseId/lessons')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CourseLessonsController {
    constructor(private readonly courseLessonsService: CourseLessonsService) {}

    private requireOrganizationId(organizationId: string | undefined): string {
        if (!organizationId) {
            throw new BadRequestException('Selecione uma organização ativa.');
        }
        return organizationId;
    }

    @Post()
    @Roles(...ALL_ORG_ROLES)
    create(
        @Param('courseId') courseId: string,
        @Body() dto: CreateCourseLessonDto,
        @ActiveOrganizationId() organizationId: string | undefined,
    ) {
        return this.courseLessonsService.create(courseId, this.requireOrganizationId(organizationId), dto);
    }

    @Patch(':lessonId')
    @Roles(...ALL_ORG_ROLES)
    update(
        @Param('courseId') courseId: string,
        @Param('lessonId') lessonId: string,
        @Body() dto: UpdateCourseLessonDto,
        @ActiveOrganizationId() organizationId: string | undefined,
    ) {
        return this.courseLessonsService.update(courseId, this.requireOrganizationId(organizationId), lessonId, dto);
    }

    @Delete(':lessonId')
    @Roles(...ADMIN_ROLES)
    remove(
        @Param('courseId') courseId: string,
        @Param('lessonId') lessonId: string,
        @ActiveOrganizationId() organizationId: string | undefined,
    ) {
        return this.courseLessonsService.remove(courseId, this.requireOrganizationId(organizationId), lessonId);
    }

    @Put(':lessonId/progress')
    @Roles(...ALL_ORG_ROLES)
    markProgress(
        @Param('courseId') courseId: string,
        @Param('lessonId') lessonId: string,
        @Body() dto: UpdateLessonProgressDto,
        @ActiveOrganizationId() organizationId: string | undefined,
        @CurrentUser() user: AuthenticatedUser,
    ) {
        return this.courseLessonsService.markProgress(
            courseId,
            this.requireOrganizationId(organizationId),
            lessonId,
            user.id,
            dto.completed,
        );
    }
}
