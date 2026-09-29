// backend/src/courses/course-lessons.service.ts
//
// Aulas em vídeo dentro de um módulo da turma. Marcar uma aula como assistida
// (`markProgress`) reavalia a elegibilidade de certificado do aluno (decisão
// 16/17 do docs/decisoes.md — `Course.requireAllLessonsWatched`), do mesmo
// jeito que lançar presença faz em class-sessions.service.ts.
//
// Fase 2 de posse de dado (docs/decisoes.md, decisão 22/25): create/update só
// são permitidos a quem tem `courses:manage` (admin) OU é CourseInstructor
// desta turma especificamente — antes disso, o controller liberava para
// qualquer ORG_USER autenticado, mesmo de fora da turma.
//
// Vários professores: um módulo pode ter professores responsáveis (`CourseModuleInstructor`).
// Com responsáveis, só eles (ou quem tem `courses:manage`) criam/editam aulas nele; sem
// responsáveis, vale a regra anterior (qualquer instrutor da turma edita). Excluir aula é do
// admin ou de um responsável explícito pelo módulo — módulo "livre" não deixa qualquer
// instrutor apagar conteúdo.

import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CertificatesService } from '../certificates/certificates.service';
import { CreateCourseLessonDto } from './dto/create-course-lesson.dto';
import { UpdateCourseLessonDto } from './dto/update-course-lesson.dto';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { userHasPermission } from '../auth/common/user-has-permission.util';
import { INSTRUCTOR_USER_SELECT } from './course-instructors.util';

@Injectable()
export class CourseLessonsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly certificatesService: CertificatesService,
    ) {}

    /** Responsáveis do módulo ({id,name}); lista vazia = módulo livre para qualquer instrutor da turma. */
    private async moduleResponsibles(moduleId: string) {
        return this.prisma.courseModuleInstructor.findMany({ where: { moduleId }, include: { user: INSTRUCTOR_USER_SELECT } });
    }

    private async assertCanEditLessonsInModule(courseId: string, moduleId: string, user: AuthenticatedUser) {
        if (userHasPermission(user, 'courses:manage')) return;

        const isInstructor = await this.prisma.courseInstructor.findFirst({
            where: { courseId, userId: user.id },
            select: { id: true },
        });
        if (!isInstructor) {
            throw new ForbiddenException('Você não é instrutor desta turma.');
        }

        const responsibles = await this.moduleResponsibles(moduleId);
        if (responsibles.length > 0 && !responsibles.some((r) => r.userId === user.id)) {
            throw new ForbiddenException(`Este módulo está sob responsabilidade de: ${responsibles.map((r) => r.user.name).join(', ')}.`);
        }
    }

    private async requireCourse(courseId: string, organizationId: string) {
        const course = await this.prisma.course.findFirst({ where: { id: courseId, organizationId } });
        if (!course) {
            throw new NotFoundException(`Turma com ID ${courseId} não encontrada nesta organização.`);
        }
        return course;
    }

    private async requireModuleInCourse(courseId: string, moduleId: string) {
        const courseModule = await this.prisma.courseModule.findFirst({ where: { id: moduleId, courseId } });
        if (!courseModule) {
            throw new NotFoundException(`Módulo com ID ${moduleId} não encontrado nesta turma.`);
        }
        return courseModule;
    }

    private async requireLesson(courseId: string, organizationId: string, lessonId: string) {
        await this.requireCourse(courseId, organizationId);
        const lesson = await this.prisma.courseLesson.findFirst({
            where: { id: lessonId, module: { courseId } },
        });
        if (!lesson) {
            throw new NotFoundException(`Aula com ID ${lessonId} não encontrada nesta turma.`);
        }
        return lesson;
    }

    async create(courseId: string, organizationId: string, dto: CreateCourseLessonDto, user: AuthenticatedUser) {
        await this.requireCourse(courseId, organizationId);
        await this.requireModuleInCourse(courseId, dto.moduleId);
        await this.assertCanEditLessonsInModule(courseId, dto.moduleId, user);

        return this.prisma.courseLesson.create({
            data: {
                moduleId: dto.moduleId,
                title: dto.title,
                content: dto.content,
                videoUrl: dto.videoUrl,
                videoKey: dto.videoKey,
                duration: dto.duration,
                order: dto.order ?? 0,
            },
        });
    }

    async update(courseId: string, organizationId: string, lessonId: string, dto: UpdateCourseLessonDto, user: AuthenticatedUser) {
        const lesson = await this.requireLesson(courseId, organizationId, lessonId);
        await this.assertCanEditLessonsInModule(courseId, lesson.moduleId, user);
        return this.prisma.courseLesson.update({ where: { id: lessonId }, data: dto });
    }

    async remove(courseId: string, organizationId: string, lessonId: string, user: AuthenticatedUser) {
        const lesson = await this.requireLesson(courseId, organizationId, lessonId);
        if (!userHasPermission(user, 'courses:manage')) {
            const responsibles = await this.moduleResponsibles(lesson.moduleId);
            if (!responsibles.some((r) => r.userId === user.id)) {
                throw new ForbiddenException('Só quem é responsável pelo módulo (ou a coordenação) pode excluir aulas dele.');
            }
        }
        await this.prisma.courseLesson.delete({ where: { id: lessonId } });
        return { id: lessonId };
    }

    async markProgress(courseId: string, organizationId: string, lessonId: string, userId: string, completed: boolean) {
        await this.requireLesson(courseId, organizationId, lessonId);

        const progress = await this.prisma.lessonProgress.upsert({
            where: { userId_lessonId: { userId, lessonId } },
            create: { userId, lessonId, completed, completedAt: completed ? new Date() : undefined },
            update: { completed, completedAt: completed ? new Date() : null },
        });

        if (completed) {
            const enrollment = await this.prisma.enrollment.findFirst({
                where: { courseId, studentProfile: { userId } },
                select: { id: true },
            });
            if (enrollment) {
                // Best-effort: aulas assistidas mudaram, reavalia elegibilidade de certificado.
                await this.certificatesService.issueIfEligible(enrollment.id);
            }
        }

        return progress;
    }
}
