// backend/src/courses/course-lessons.controller.ts
//
// Create/update de aula liberado a qualquer papel autenticado da organização
// de propósito — instrutor é um ORG_USER comum, e "professor sobe sua aula"
// é justamente o caso de uso que não pode depender de ganhar a permissão
// `courses:manage` (essa é para quem administra a turma inteira: agenda,
// matrícula etc.). Só a exclusão de aula fica atrás de `courses:manage` —
// apagar conteúdo de terceiros é uma ação mais sensível que publicar o
// próprio. Marcar progresso é sempre sobre o próprio usuário autenticado.

import { Controller, Post, Body, Patch, Put, Param, Delete, UseGuards, BadRequestException } from '@nestjs/common';
import { CourseLessonsService } from './course-lessons.service';
import { CreateCourseLessonDto } from './dto/create-course-lesson.dto';
import { UpdateCourseLessonDto } from './dto/update-course-lesson.dto';
import { UpdateLessonProgressDto } from './dto/update-lesson-progress.dto';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { RolesGuard } from '../auth/guard/roles.guard';
import { PermissionsGuard, RequirePermission } from '../auth/guard/permissions.guard';
import { Roles } from '../auth/decorator/roles.decorator';
import { Role } from '@prisma/client';
import { ActiveOrganizationId } from '../auth/common/active-organization-id.decorator';
import { CurrentUser } from '../auth/common/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';

const ALL_ORG_ROLES = [Role.SUPER_ADMIN, Role.GROUP_ADMIN, Role.ORG_ADMIN, Role.ORG_USER] as const;

@Controller('courses/:courseId/lessons')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
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
    @RequirePermission('courses:manage')
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
