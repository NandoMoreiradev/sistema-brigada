// backend/src/events/designation-conflicts.util.ts
//
// Regra única de "a mesma pessoa não pode estar em dois turnos que se sobrepõem", usada tanto ao
// criar/editar designações quanto ao remarcar um turno inteiro (EventShiftsService).
//
// Janelas encostadas (turno que termina 12:00 e outro que começa 12:00) NÃO conflitam — é a
// passagem de turno sem intervalo. Designações recusadas liberam o horário.

import { DesignationStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export async function findConflictingDesignation(
    prisma: PrismaService,
    staffMemberId: string,
    start: Date,
    end: Date,
    excludeDesignationId?: string,
) {
    return prisma.designation.findFirst({
        where: {
            staffMemberId,
            status: { not: DesignationStatus.DECLINED },
            shiftStart: { lt: end },
            shiftEnd: { gt: start },
            ...(excludeDesignationId ? { id: { not: excludeDesignationId } } : {}),
        },
        include: { eventOperation: { include: { event: { select: { title: true } } } } },
    });
}

/** Duas janelas se sobrepõem (encostar não conta). */
export function windowsOverlap(a: { start: Date; end: Date }, b: { start: Date; end: Date }): boolean {
    return a.start < b.end && a.end > b.start;
}
