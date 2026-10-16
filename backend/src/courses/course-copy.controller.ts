// backend/src/courses/course-copy.controller.ts
//
// Copiar agenda, programação e vídeo-aulas de outra turma (ver course-copy.service.ts). É gestão
// da turma, então exige `courses:manage` (a lista de turmas de onde copiar também é dela).

import { Body, Controller, Get, Param, Post, Query, UseGuards, BadRequestException } from '@nestjs/common';
import { CourseCopyService } from './course-copy.service';
import { CopyCourseContentDto } from './dto/copy-course.dto';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { RolesGuard } from '../auth/guard/roles.guard';
import { PermissionsGuard, RequirePermission } from '../auth/guard/permissions.guard';
import { ActiveOrganizationId } from '../auth/common/active-organization-id.decorator';
import { CurrentUser } from '../auth/common/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';

function requireOrganizationId(organizationId: string | undefined): string {
    if (!organizationId) {
        throw new BadRequestException('Selecione uma organização ativa.');
    }
    return organizationId;
}

@Controller('courses/:courseId')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class CourseCopyController {
    constructor(private readonly copyService: CourseCopyService) {}

    @Get('copy-preview')
    @RequirePermission('courses:manage')
    preview(
        @Param('courseId') courseId: string,
        @Query('sourceCourseId') sourceCourseId: string,
        @ActiveOrganizationId() organizationId: string | undefined,
    ) {
        if (!sourceCourseId) throw new BadRequestException('Informe a turma de origem.');
        return this.copyService.preview(courseId, sourceCourseId, requireOrganizationId(organizationId));
    }

    @Post('copy-from')
    @RequirePermission('courses:manage')
    copy(
        @Param('courseId') courseId: string,
        @Body() dto: CopyCourseContentDto,
        @ActiveOrganizationId() organizationId: string | undefined,
        @CurrentUser() user: AuthenticatedUser,
    ) {
        return this.copyService.copy(courseId, requireOrganizationId(organizationId), dto, user.id);
    }
}
