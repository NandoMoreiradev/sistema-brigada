// backend/src/courses/courses.service.ts
//
// Adaptado do `CoursesService` do maskotCrmEdu (docs/decisoes.md, tabela de
// reaproveitamento), mas sem `academicYear`/`teacherAssignments` (o schema
// deste projeto tem `CourseInstructor`, mais simples) e sem trash/restore por
// enquanto. Diferença estrutural principal: aqui `Course` é o "detalhe" de um
// `Event` (kind=TURMA) — criar/remover uma turma sempre passa pelo `Event`
// pai, para a cascata de soft delete do `PrismaService` funcionar (ver
// SOFT_DELETE_CASCADE_TARGETS em prisma/prisma.service.ts).

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, EventKind } from '@prisma/client';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { ListCoursesDto } from './dto/list-courses.dto';

const courseInclude = {
    event: true,
    instructors: { include: { user: { select: { id: true, name: true, email: true } } } },
    _count: { select: { enrollments: true, sessions: true } },
} satisfies Prisma.CourseInclude;

@Injectable()
export class CoursesService {
    constructor(private readonly prisma: PrismaService) {}

    async create(dto: CreateCourseDto, organizationId: string, createdByUserId: string) {
        return this.prisma.$transaction(async (tx) => {
            const event = await tx.event.create({
                data: {
                    organizationId,
                    kind: EventKind.TURMA,
                    title: dto.title,
                    location: dto.location,
                    startDate: new Date(dto.startDate),
                    endDate: dto.endDate ? new Date(dto.endDate) : undefined,
                    createdByUserId,
                },
            });

            const course = await tx.course.create({
                data: {
                    eventId: event.id,
                    organizationId,
                    category: dto.category,
                    vacancies: dto.vacancies,
                    minAttendancePercent: dto.minAttendancePercent ?? 75,
                    requireAllLessonsWatched: dto.requireAllLessonsWatched ?? true,
                    recyclingValidityMonths: dto.recyclingValidityMonths,
                    recommendedRecyclingCourseId: dto.recommendedRecyclingCourseId,
                },
            });

            if (dto.instructorUserIds?.length) {
                await tx.courseInstructor.createMany({
                    data: dto.instructorUserIds.map((userId) => ({ courseId: course.id, userId })),
                    skipDuplicates: true,
                });
            }

            return tx.course.findUniqueOrThrow({ where: { id: course.id }, include: courseInclude });
        });
    }

    async findAll(organizationId: string, query: ListCoursesDto) {
        const { search, active, page = 1, limit = 20 } = query;

        const where: Prisma.CourseWhereInput = { organizationId };
        if (active !== undefined) {
            where.active = active;
        }
        if (search) {
            where.event = { title: { contains: search, mode: 'insensitive' } };
        }

        const [courses, total] = await Promise.all([
            this.prisma.course.findMany({
                where,
                include: courseInclude,
                orderBy: { event: { startDate: 'desc' } },
                skip: (page - 1) * limit,
                take: limit,
            }),
            this.prisma.course.count({ where }),
        ]);

        return { data: courses, total, page, limit, totalPages: Math.ceil(total / limit) };
    }

    async findOne(id: string, organizationId: string) {
        const course = await this.prisma.course.findFirst({
            where: { id, organizationId },
            include: {
                ...courseInclude,
                sessions: { include: { room: true, classLog: true }, orderBy: { date: 'asc' } },
            },
        });

        if (!course) {
            throw new NotFoundException(`Turma com ID ${id} não encontrada nesta organização.`);
        }

        return course;
    }

    async update(id: string, organizationId: string, dto: UpdateCourseDto) {
        const course = await this.findOne(id, organizationId);
        const { status, ...courseFields } = dto;

        return this.prisma.$transaction(async (tx) => {
            if (status || courseFields.title || courseFields.location || courseFields.startDate || courseFields.endDate) {
                await tx.event.update({
                    where: { id: course.eventId },
                    data: {
                        status,
                        title: courseFields.title,
                        location: courseFields.location,
                        startDate: courseFields.startDate ? new Date(courseFields.startDate) : undefined,
                        endDate: courseFields.endDate ? new Date(courseFields.endDate) : undefined,
                    },
                });
            }

            await tx.course.update({
                where: { id },
                data: {
                    category: courseFields.category,
                    vacancies: courseFields.vacancies,
                    minAttendancePercent: courseFields.minAttendancePercent,
                    requireAllLessonsWatched: courseFields.requireAllLessonsWatched,
                    recyclingValidityMonths: courseFields.recyclingValidityMonths,
                    recommendedRecyclingCourseId: courseFields.recommendedRecyclingCourseId,
                },
            });

            return tx.course.findUniqueOrThrow({ where: { id }, include: courseInclude });
        });
    }

    /** Remove a turma soft-deletando o `Event` pai — a cascata do PrismaService cuida do `Course`. */
    async remove(id: string, organizationId: string) {
        const course = await this.findOne(id, organizationId);
        await this.prisma.event.delete({ where: { id: course.eventId } });
        return { id };
    }

    async assignInstructor(courseId: string, organizationId: string, userId: string) {
        await this.findOne(courseId, organizationId);

        const targetUser = await this.prisma.user.findFirst({ where: { id: userId, organizationId } });
        if (!targetUser) {
            throw new BadRequestException('Usuário informado não pertence a esta organização.');
        }

        await this.prisma.courseInstructor.upsert({
            where: { courseId_userId: { courseId, userId } },
            create: { courseId, userId },
            update: {},
        });

        return this.findOne(courseId, organizationId);
    }

    async removeInstructor(courseId: string, organizationId: string, userId: string) {
        await this.findOne(courseId, organizationId);
        await this.prisma.courseInstructor.deleteMany({ where: { courseId, userId } });
        return this.findOne(courseId, organizationId);
    }
}
