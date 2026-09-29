// backend/src/courses/course-instructors.util.ts
//
// Regras compartilhadas de "quem leciona o quê" numa turma: um módulo ou uma aula presencial só
// pode ter como responsável quem já é CourseInstructor da própria turma.

import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** Só {id,name} — o suficiente para a tela mostrar os responsáveis sem expor e-mail/telefone. */
export const INSTRUCTOR_USER_SELECT = { select: { id: true, name: true } } as const;

/** Valida que todos os `userIds` são instrutores da turma e devolve a lista sem duplicatas. */
export async function assertAreCourseInstructors(prisma: PrismaService, courseId: string, userIds: string[]): Promise<string[]> {
    const unique = [...new Set(userIds)];
    if (unique.length === 0) return unique;

    const found = await prisma.courseInstructor.findMany({ where: { courseId, userId: { in: unique } }, select: { userId: true } });
    const foundIds = new Set(found.map((f) => f.userId));
    if (unique.some((id) => !foundIds.has(id))) {
        throw new BadRequestException('Só é possível escolher professores que já são instrutores desta turma.');
    }
    return unique;
}
