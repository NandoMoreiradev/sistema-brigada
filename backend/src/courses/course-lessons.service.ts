// backend/src/courses/course-lessons.service.ts
//
// Aulas em vídeo dentro de um módulo da turma. Marcar uma aula como assistida
// (`markProgress`) reavalia a elegibilidade de certificado do aluno (decisão
// 16/17 do docs/decisoes.md — `Course.requireAllLessonsWatched`), do mesmo
// jeito que lançar presença faz em class-sessions.service.ts.

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CertificatesService } from '../certificates/certificates.service';
import { CreateCourseLessonDto } from './dto/create-course-lesson.dto';
import { UpdateCourseLessonDto } from './dto/update-course-lesson.dto';

@Injectable()
export class CourseLessonsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly certificatesService: CertificatesService,
    ) {}

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

    async create(courseId: string, organizationId: string, dto: CreateCourseLessonDto) {
        await this.requireCourse(courseId, organizationId);
        await this.requireModuleInCourse(courseId, dto.moduleId);

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

    async update(courseId: string, organizationId: string, lessonId: string, dto: UpdateCourseLessonDto) {
        await this.requireLesson(courseId, organizationId, lessonId);
        return this.prisma.courseLesson.update({ where: { id: lessonId }, data: dto });
    }

    async remove(courseId: string, organizationId: string, lessonId: string) {
        await this.requireLesson(courseId, organizationId, lessonId);
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
