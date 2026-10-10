import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCourseModuleDto } from './dto/create-course-module.dto';
import { UpdateCourseModuleDto } from './dto/update-course-module.dto';
import { ReorderCourseModulesDto } from './dto/reorder-course-items.dto';
import { assertAreCourseInstructors, INSTRUCTOR_USER_SELECT } from './course-instructors.util';

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
        // Sem ordem explícita, o módulo novo entra no fim da lista.
        let order = dto.order;
        if (order === undefined) {
            const last = await this.prisma.courseModule.aggregate({ where: { courseId }, _max: { order: true } });
            order = (last._max.order ?? -1) + 1;
        }
        return this.prisma.courseModule.create({ data: { courseId, title: dto.title, order } });
    }

    /** Grava a nova ordem dos módulos: `ids` deve trazer todos os módulos da turma, sem repetir. */
    async reorder(courseId: string, organizationId: string, dto: ReorderCourseModulesDto) {
        await this.requireCourse(courseId, organizationId);
        const modules = await this.prisma.courseModule.findMany({ where: { courseId }, select: { id: true } });
        const ids = [...new Set(dto.ids)];
        if (ids.length !== modules.length || !modules.every((m) => ids.includes(m.id))) {
            throw new BadRequestException('Informe todos os módulos da turma, sem repetir.');
        }
        await this.prisma.$transaction(ids.map((id, order) => this.prisma.courseModule.update({ where: { id }, data: { order } })));
        return { ids };
    }

    /** Lista módulos com aulas e o progresso do usuário atual em cada aula. */
    async findAll(courseId: string, organizationId: string, currentUserId: string) {
        await this.requireCourse(courseId, organizationId);
        return this.prisma.courseModule.findMany({
            where: { courseId },
            include: {
                instructors: { include: { user: INSTRUCTOR_USER_SELECT } },
                lessons: {
                    where: { active: true },
                    orderBy: [{ order: 'asc' }, { id: 'asc' }],
                    include: {
                        progress: { where: { userId: currentUserId } },
                        videos: { orderBy: { order: 'asc' } },
                        files: { orderBy: { createdAt: 'asc' } },
                    },
                },
            },
            orderBy: [{ order: 'asc' }, { id: 'asc' }],
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

    /** Define quem é responsável pelo módulo. Lista vazia libera o módulo para qualquer instrutor da turma. */
    async setInstructors(courseId: string, organizationId: string, moduleId: string, userIds: string[]) {
        await this.requireModule(courseId, organizationId, moduleId);
        const validIds = await assertAreCourseInstructors(this.prisma, courseId, userIds);

        return this.prisma.courseModule.update({
            where: { id: moduleId },
            data: { instructors: { deleteMany: {}, create: validIds.map((userId) => ({ userId })) } },
            include: { instructors: { include: { user: INSTRUCTOR_USER_SELECT } } },
        });
    }

    async remove(courseId: string, organizationId: string, moduleId: string) {
        await this.requireModule(courseId, organizationId, moduleId);
        await this.prisma.courseModule.delete({ where: { id: moduleId } });
        return { id: moduleId };
    }
}
