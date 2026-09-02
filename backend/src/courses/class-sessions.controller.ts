// backend/src/courses/class-sessions.controller.ts
//
// Agendamento de aula é trabalho administrativo (create/update/remove restrito
// a admin), mas diário de aula e chamada são lançados por quem está em sala —
// hoje isso inclui qualquer ORG_USER autenticado, porque o RBAC granular
// (RoleAssignment/Permission) ainda não está populado neste projeto para
// restringir "só o instrutor designado desta turma" (ver docs/decisoes.md).

import { Controller, Get, Post, Put, Body, Patch, Param, Delete, UseGuards, BadRequestException } from '@nestjs/common';
import { ClassSessionsService } from './class-sessions.service';
import { CreateClassSessionDto } from './dto/create-class-session.dto';
import { UpdateClassSessionDto } from './dto/update-class-session.dto';
import { UpsertClassLogDto } from './dto/upsert-class-log.dto';
import { MarkAttendanceDto } from './dto/mark-attendance.dto';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { RolesGuard } from '../auth/guard/roles.guard';
import { Roles } from '../auth/decorator/roles.decorator';
import { Role } from '@prisma/client';
import { ActiveOrganizationId } from '../auth/common/active-organization-id.decorator';
import { CurrentUser } from '../auth/common/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';

const ADMIN_ROLES = [Role.SUPER_ADMIN, Role.GROUP_ADMIN, Role.ORG_ADMIN] as const;
const ALL_ORG_ROLES = [Role.SUPER_ADMIN, Role.GROUP_ADMIN, Role.ORG_ADMIN, Role.ORG_USER] as const;

@Controller('courses/:courseId/sessions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ClassSessionsController {
    constructor(private readonly classSessionsService: ClassSessionsService) {}

    private requireOrganizationId(organizationId: string | undefined): string {
        if (!organizationId) {
            throw new BadRequestException('Selecione uma organização ativa para gerenciar aulas.');
        }
        return organizationId;
    }

    @Post()
    @Roles(...ADMIN_ROLES)
    create(
        @Param('courseId') courseId: string,
        @Body() dto: CreateClassSessionDto,
        @ActiveOrganizationId() organizationId: string | undefined,
    ) {
        return this.classSessionsService.create(courseId, this.requireOrganizationId(organizationId), dto);
    }

    @Get()
    @Roles(...ALL_ORG_ROLES)
    findAll(@Param('courseId') courseId: string, @ActiveOrganizationId() organizationId: string | undefined) {
        return this.classSessionsService.findAll(courseId, this.requireOrganizationId(organizationId));
    }

    @Patch(':sessionId')
    @Roles(...ADMIN_ROLES)
    update(
        @Param('courseId') courseId: string,
        @Param('sessionId') sessionId: string,
        @Body() dto: UpdateClassSessionDto,
        @ActiveOrganizationId() organizationId: string | undefined,
    ) {
        return this.classSessionsService.update(courseId, this.requireOrganizationId(organizationId), sessionId, dto);
    }

    @Delete(':sessionId')
    @Roles(...ADMIN_ROLES)
    remove(
        @Param('courseId') courseId: string,
        @Param('sessionId') sessionId: string,
        @ActiveOrganizationId() organizationId: string | undefined,
    ) {
        return this.classSessionsService.remove(courseId, this.requireOrganizationId(organizationId), sessionId);
    }

    @Put(':sessionId/log')
    @Roles(...ALL_ORG_ROLES)
    upsertLog(
        @Param('courseId') courseId: string,
        @Param('sessionId') sessionId: string,
        @Body() dto: UpsertClassLogDto,
        @ActiveOrganizationId() organizationId: string | undefined,
        @CurrentUser() user: AuthenticatedUser,
    ) {
        return this.classSessionsService.upsertLog(courseId, this.requireOrganizationId(organizationId), sessionId, user.id, dto);
    }

    @Get(':sessionId/attendance')
    @Roles(...ALL_ORG_ROLES)
    getAttendance(
        @Param('courseId') courseId: string,
        @Param('sessionId') sessionId: string,
        @ActiveOrganizationId() organizationId: string | undefined,
    ) {
        return this.classSessionsService.getAttendanceRoster(courseId, this.requireOrganizationId(organizationId), sessionId);
    }

    @Put(':sessionId/attendance')
    @Roles(...ALL_ORG_ROLES)
    markAttendance(
        @Param('courseId') courseId: string,
        @Param('sessionId') sessionId: string,
        @Body() dto: MarkAttendanceDto,
        @ActiveOrganizationId() organizationId: string | undefined,
    ) {
        return this.classSessionsService.markAttendance(courseId, this.requireOrganizationId(organizationId), sessionId, dto);
    }
}
