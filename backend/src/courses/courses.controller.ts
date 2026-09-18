// backend/src/courses/courses.controller.ts
//
// Fase 3 de posse de dado (docs/decisoes.md): a listagem completa (`findAll`)
// fica atrás de `courses:manage` — quem só quer ver a própria turma (aluno
// matriculado ou instrutor) usa `GET /me/courses`, não esta lista. O detalhe
// (`findOne`) continua aberto a ALL_ORG_ROLES no guard, mas
// CoursesService.findOne checa posse por dentro (courses:manage OU
// instrutor/matriculado nesta turma específica) — é isso que permite ao
// aluno/instrutor abrir a própria turma sem enxergar as outras.

import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query, BadRequestException } from '@nestjs/common';
import { CoursesService } from './courses.service';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { ListCoursesDto } from './dto/list-courses.dto';
import { AssignInstructorDto } from './dto/assign-instructor.dto';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { RolesGuard } from '../auth/guard/roles.guard';
import { PermissionsGuard, RequirePermission } from '../auth/guard/permissions.guard';
import { Roles } from '../auth/decorator/roles.decorator';
import { Role } from '@prisma/client';
import { ActiveOrganizationId } from '../auth/common/active-organization-id.decorator';
import { CurrentUser } from '../auth/common/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';

@Controller('courses')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class CoursesController {
    constructor(private readonly coursesService: CoursesService) {}

    private requireOrganizationId(organizationId: string | undefined): string {
        if (!organizationId) {
            throw new BadRequestException('Selecione uma organização ativa para gerenciar turmas.');
        }
        return organizationId;
    }

    @Post()
    @RequirePermission('courses:manage')
    create(
        @Body() dto: CreateCourseDto,
        @ActiveOrganizationId() organizationId: string | undefined,
        @CurrentUser() user: AuthenticatedUser,
    ) {
        return this.coursesService.create(dto, this.requireOrganizationId(organizationId), user.id);
    }

    @Get()
    @RequirePermission('courses:manage')
    findAll(@Query() query: ListCoursesDto, @ActiveOrganizationId() organizationId: string | undefined) {
        return this.coursesService.findAll(this.requireOrganizationId(organizationId), query);
    }

    @Get(':id')
    @Roles(Role.SUPER_ADMIN, Role.GROUP_ADMIN, Role.ORG_ADMIN, Role.ORG_USER)
    findOne(
        @Param('id') id: string,
        @ActiveOrganizationId() organizationId: string | undefined,
        @CurrentUser() user: AuthenticatedUser,
    ) {
        return this.coursesService.findOne(id, this.requireOrganizationId(organizationId), user);
    }

    @Patch(':id')
    @RequirePermission('courses:manage')
    update(
        @Param('id') id: string,
        @Body() dto: UpdateCourseDto,
        @ActiveOrganizationId() organizationId: string | undefined,
    ) {
        return this.coursesService.update(id, this.requireOrganizationId(organizationId), dto);
    }

    @Delete(':id')
    @RequirePermission('courses:manage')
    remove(@Param('id') id: string, @ActiveOrganizationId() organizationId: string | undefined) {
        return this.coursesService.remove(id, this.requireOrganizationId(organizationId));
    }

    @Post(':id/instructors')
    @RequirePermission('courses:manage')
    assignInstructor(
        @Param('id') id: string,
        @Body() dto: AssignInstructorDto,
        @ActiveOrganizationId() organizationId: string | undefined,
    ) {
        return this.coursesService.assignInstructor(id, this.requireOrganizationId(organizationId), dto.userId);
    }

    @Delete(':id/instructors/:userId')
    @RequirePermission('courses:manage')
    removeInstructor(
        @Param('id') id: string,
        @Param('userId') userId: string,
        @ActiveOrganizationId() organizationId: string | undefined,
    ) {
        return this.coursesService.removeInstructor(id, this.requireOrganizationId(organizationId), userId);
    }
}
