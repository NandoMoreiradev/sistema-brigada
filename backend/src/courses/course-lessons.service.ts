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

import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CertificatesService } from '../certificates/certificates.service';
import { CreateCourseLessonDto } from './dto/create-course-lesson.dto';
import { UpdateCourseLessonDto } from './dto/update-course-lesson.dto';
import { ReorderCourseLessonsDto } from './dto/reorder-course-items.dto';
import { CreateCourseLessonFileDto } from './dto/create-course-lesson-file.dto';
import { UpdateLessonProgressDto } from './dto/update-lesson-progress.dto';
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

        // Sem ordem explícita, a aula nova entra no fim do módulo.
        let order = dto.order;
        if (order === undefined) {
            const last = await this.prisma.courseLesson.aggregate({ where: { moduleId: dto.moduleId }, _max: { order: true } });
            order = (last._max.order ?? -1) + 1;
        }

        return this.prisma.courseLesson.create({
            data: {
                moduleId: dto.moduleId,
                title: dto.title,
                content: dto.content,
                duration: dto.duration,
                order,
                videos: {
                    create: (dto.videos ?? []).map((video, index) => ({
                        title: video.title || null,
                        url: video.url,
                        storageKey: video.storageKey || null,
                        order: index,
                    })),
                },
            },
            include: { videos: { orderBy: { order: 'asc' } } },
        });
    }

    /** Grava a nova ordem das aulas de um módulo: `ids` deve trazer todas as aulas ativas dele, sem repetir. */
    async reorder(courseId: string, organizationId: string, dto: ReorderCourseLessonsDto, user: AuthenticatedUser) {
        await this.requireCourse(courseId, organizationId);
        await this.requireModuleInCourse(courseId, dto.moduleId);
        await this.assertCanEditLessonsInModule(courseId, dto.moduleId, user);

        const lessons = await this.prisma.courseLesson.findMany({ where: { moduleId: dto.moduleId, active: true }, select: { id: true } });
        const ids = [...new Set(dto.ids)];
        if (ids.length !== lessons.length || !lessons.every((l) => ids.includes(l.id))) {
            throw new BadRequestException('Informe todas as aulas do módulo, sem repetir.');
        }
        await this.prisma.$transaction(ids.map((id, order) => this.prisma.courseLesson.update({ where: { id }, data: { order } })));
        return { ids };
    }

    async update(courseId: string, organizationId: string, lessonId: string, dto: UpdateCourseLessonDto, user: AuthenticatedUser) {
        const lesson = await this.requireLesson(courseId, organizationId, lessonId);
        await this.assertCanEditLessonsInModule(courseId, lesson.moduleId, user);
        const { videos, ...data } = dto;

        return this.prisma.$transaction(async (tx) => {
            if (videos) {
                // `videos` é a lista completa: o que não veio sai, o que tem id é atualizado, o resto é criado.
                const existing = await tx.courseLessonVideo.findMany({ where: { lessonId }, select: { id: true } });
                const existingIds = new Set(existing.map((v) => v.id));
                const keptIds = videos.map((v) => v.id).filter((id): id is string => !!id && existingIds.has(id));
                await tx.courseLessonVideo.deleteMany({ where: { lessonId, id: { notIn: keptIds } } });
                for (const [index, video] of videos.entries()) {
                    const fields = { title: video.title || null, url: video.url, storageKey: video.storageKey || null, order: index };
                    if (video.id && existingIds.has(video.id)) {
                        await tx.courseLessonVideo.update({ where: { id: video.id }, data: fields });
                    } else {
                        await tx.courseLessonVideo.create({ data: { lessonId, ...fields } });
                    }
                }
            }
            return tx.courseLesson.update({
                where: { id: lessonId },
                data,
                include: { videos: { orderBy: { order: 'asc' } } },
            });
        });
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

    /** Anexar material de apoio segue a mesma regra de editar a aula (responsáveis do módulo / instrutores / admin). */
    async addFile(courseId: string, organizationId: string, lessonId: string, dto: CreateCourseLessonFileDto, user: AuthenticatedUser) {
        const lesson = await this.requireLesson(courseId, organizationId, lessonId);
        await this.assertCanEditLessonsInModule(courseId, lesson.moduleId, user);
        return this.prisma.courseLessonFile.create({
            data: {
                lessonId,
                name: dto.name,
                storageKey: dto.storageKey,
                externalUrl: dto.externalUrl,
                mimeType: dto.mimeType,
                size: dto.size,
                uploadedByUserId: user.id,
            },
        });
    }

    async removeFile(courseId: string, organizationId: string, lessonId: string, fileId: string, user: AuthenticatedUser) {
        const lesson = await this.requireLesson(courseId, organizationId, lessonId);
        await this.assertCanEditLessonsInModule(courseId, lesson.moduleId, user);
        const file = await this.prisma.courseLessonFile.findFirst({ where: { id: fileId, lessonId } });
        if (!file) {
            throw new NotFoundException(`Arquivo com ID ${fileId} não encontrado nesta aula.`);
        }
        await this.prisma.courseLessonFile.delete({ where: { id: fileId } });
        return { id: fileId };
    }

    /**
     * `completed` marca/desmarca a aula à mão (aula só com links externos). `watchedVideoId` registra
     * que um vídeo enviado tocou até o fim; a aula conclui sozinha quando todos os vídeos enviados
     * dela foram assistidos.
     */
    async markProgress(courseId: string, organizationId: string, lessonId: string, userId: string, dto: UpdateLessonProgressDto) {
        await this.requireLesson(courseId, organizationId, lessonId);

        let progress;
        if (dto.watchedVideoId) {
            const uploadedVideos = await this.prisma.courseLessonVideo.findMany({
                where: { lessonId, storageKey: { not: null } },
                select: { id: true },
            });
            if (!uploadedVideos.some((v) => v.id === dto.watchedVideoId)) {
                throw new NotFoundException(`Vídeo com ID ${dto.watchedVideoId} não encontrado nesta aula.`);
            }
            const current = await this.prisma.lessonProgress.findUnique({ where: { userId_lessonId: { userId, lessonId } } });
            const watchedVideoIds = [...new Set([...(current?.watchedVideoIds ?? []), dto.watchedVideoId])];
            const allWatched = uploadedVideos.every((v) => watchedVideoIds.includes(v.id));
            const completed = (current?.completed ?? false) || allWatched;
            const completedAt = current?.completedAt ?? (completed ? new Date() : null);
            progress = await this.prisma.lessonProgress.upsert({
                where: { userId_lessonId: { userId, lessonId } },
                create: { userId, lessonId, watchedVideoIds, completed, completedAt },
                update: { watchedVideoIds, completed, completedAt },
            });
        } else if (dto.completed !== undefined) {
            const { completed } = dto;
            progress = await this.prisma.lessonProgress.upsert({
                where: { userId_lessonId: { userId, lessonId } },
                create: { userId, lessonId, completed, completedAt: completed ? new Date() : undefined },
                update: { completed, completedAt: completed ? new Date() : null },
            });
        } else {
            throw new BadRequestException('Informe completed ou watchedVideoId.');
        }

        if (progress.completed) {
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
