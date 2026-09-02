import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCourseModuleDto } from './dto/create-course-module.dto';
import { UpdateCourseModuleDto } from './dto/update-course-module.dto';

@Injectable()
export class CourseModulesService {
    constructor(private readonly prisma: PrismaService) {}

    private async requireCourse(courseId: string, organizationId: string) {
        const course = await this.prisma.course.findFirst({ where: { id: courseId, organizationId } });
        if (!course) {
            throw new NotFoundException(`Turma com ID ${courseId} não encontrada nesta organização.`);
        }
        return course;
    }

    async create(courseId: string, organizationId: string, dto: CreateCourseModuleDto) {
        await this.requireCourse(courseId, organizationId);
        return this.prisma.courseModule.create({ data: { courseId, title: dto.title, order: dto.order ?? 0 } });
    }

    /** Lista módulos com aulas e o progresso do usuário atual em cada aula. */
    async findAll(courseId: string, organizationId: string, currentUserId: string) {
        await this.requireCourse(courseId, organizationId);
        return this.prisma.courseModule.findMany({
            where: { courseId },
            include: {
                lessons: {
                    where: { active: true },
                    orderBy: { order: 'asc' },
                    include: { progress: { where: { userId: currentUserId } } },
                },
            },
            orderBy: { order: 'asc' },
        });
    }

    private async requireModule(courseId: string, organizationId: string, moduleId: string) {
        await this.requireCourse(courseId, organizationId);
        const courseModule = await this.prisma.courseModule.findFirst({ where: { id: moduleId, courseId } });
        if (!courseModule) {
            throw new NotFoundException(`Módulo com ID ${moduleId} não encontrado nesta turma.`);
        }
        return courseModule;
    }

    async update(courseId: string, organizationId: string, moduleId: string, dto: UpdateCourseModuleDto) {
        await this.requireModule(courseId, organizationId, moduleId);
        return this.prisma.courseModule.update({ where: { id: moduleId }, data: dto });
    }

    async remove(courseId: string, organizationId: string, moduleId: string) {
        await this.requireModule(courseId, organizationId, moduleId);
        await this.prisma.courseModule.delete({ where: { id: moduleId } });
        return { id: moduleId };
    }
}
