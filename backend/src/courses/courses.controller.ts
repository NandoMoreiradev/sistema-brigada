// backend/src/courses/courses.controller.ts
//
// Leitura liberada para qualquer papel autenticado da organização (portal
// único com views por papel — decisão 11 do docs/decisoes.md); escrita
// restrita a papéis administrativos. Refinar para permissão granular por
// matrícula/instrutor é trabalho futuro (RBAC granular ainda não populado
// neste projeto, ver `docs/decisoes.md`).

import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query, BadRequestException } from '@nestjs/common';
import { CoursesService } from './courses.service';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { ListCoursesDto } from './dto/list-courses.dto';
import { AssignInstructorDto } from './dto/assign-instructor.dto';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { RolesGuard } from '../auth/guard/roles.guard';
import { Roles } from '../auth/decorator/roles.decorator';
import { Role } from '@prisma/client';
import { ActiveOrganizationId } from '../auth/common/active-organization-id.decorator';
import { CurrentUser } from '../auth/common/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';

const ADMIN_ROLES = [Role.SUPER_ADMIN, Role.GROUP_ADMIN, Role.ORG_ADMIN] as const;

@Controller('courses')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CoursesController {
    constructor(private readonly coursesService: CoursesService) {}

    private requireOrganizationId(organizationId: string | undefined): string {
        if (!organizationId) {
            throw new BadRequestException('Selecione uma organização ativa para gerenciar turmas.');
        }
        return organizationId;
    }

    @Post()
    @Roles(...ADMIN_ROLES)
    create(
        @Body() dto: CreateCourseDto,
        @ActiveOrganizationId() organizationId: string | undefined,
        @CurrentUser() user: AuthenticatedUser,
    ) {
        return this.coursesService.create(dto, this.requireOrganizationId(organizationId), user.id);
    }

    @Get()
    @Roles(Role.SUPER_ADMIN, Role.GROUP_ADMIN, Role.ORG_ADMIN, Role.ORG_USER)
    findAll(@Query() query: ListCoursesDto, @ActiveOrganizationId() organizationId: string | undefined) {
        return this.coursesService.findAll(this.requireOrganizationId(organizationId), query);
    }

    @Get(':id')
    @Roles(Role.SUPER_ADMIN, Role.GROUP_ADMIN, Role.ORG_ADMIN, Role.ORG_USER)
    findOne(@Param('id') id: string, @ActiveOrganizationId() organizationId: string | undefined) {
        return this.coursesService.findOne(id, this.requireOrganizationId(organizationId));
    }

    @Patch(':id')
    @Roles(...ADMIN_ROLES)
    update(
        @Param('id') id: string,
        @Body() dto: UpdateCourseDto,
        @ActiveOrganizationId() organizationId: string | undefined,
    ) {
        return this.coursesService.update(id, this.requireOrganizationId(organizationId), dto);
    }

    @Delete(':id')
    @Roles(...ADMIN_ROLES)
    remove(@Param('id') id: string, @ActiveOrganizationId() organizationId: string | undefined) {
        return this.coursesService.remove(id, this.requireOrganizationId(organizationId));
    }

    @Post(':id/instructors')
    @Roles(...ADMIN_ROLES)
    assignInstructor(
        @Param('id') id: string,
        @Body() dto: AssignInstructorDto,
        @ActiveOrganizationId() organizationId: string | undefined,
    ) {
        return this.coursesService.assignInstructor(id, this.requireOrganizationId(organizationId), dto.userId);
    }

    @Delete(':id/instructors/:userId')
    @Roles(...ADMIN_ROLES)
    removeInstructor(
        @Param('id') id: string,
        @Param('userId') userId: string,
        @ActiveOrganizationId() organizationId: string | undefined,
    ) {
        return this.coursesService.removeInstructor(id, this.requireOrganizationId(organizationId), userId);
    }
}
