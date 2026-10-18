// backend/src/events/qualification-validity.util.ts
//
// Decisão 19/79: a pessoa só pode ser escalada se tiver certificado (de turma) ou certificação
// (externa) VÁLIDO NO DIA DO TURNO — não apenas "hoje". Usada ao criar/editar designações
// (DesignationsService) e ao remarcar um turno para mais tarde (EventShiftsService), para a
// escala nunca ficar com alguém sem certificado em campo.
//
// Vencimento é contado em dia de calendário (fuso da aplicação), igual aos lembretes e ao que a
// pessoa vê no certificado: "vence em 20/10" vale até o fim do dia 20/10.

import { ConflictException } from '@nestjs/common';
import { CertificateStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { APP_TIME_ZONE, formatAppDate } from '../common/datetime';

const DAY_MS = 86_400_000;

/**
 * Número do dia de calendário de um vencimento — só serve para comparar com outro. Certificação
 * externa guarda só a data (meia-noite UTC): lê-la no fuso do Brasil a faria "vencer um dia antes",
 * então esse valor específico é lido em UTC (mesma convenção de `formatAppDate`).
 */
export function expiryDayNumber(date: Date): number {
    const isUtcMidnight = date.getUTCHours() === 0 && date.getUTCMinutes() === 0 && date.getUTCSeconds() === 0 && date.getUTCMilliseconds() === 0;
    const ymd = date.toLocaleDateString('en-CA', { timeZone: isUtcMidnight ? 'UTC' : APP_TIME_ZONE });
    return Math.round(Date.parse(`${ymd}T00:00:00Z`) / DAY_MS);
}

/** Dia de calendário (fuso da aplicação) do último instante do turno — um turno 22:00–02:00 termina no dia seguinte. */
function shiftLastDayNumber(shift: { end: Date }): number {
    const ymd = new Date(shift.end.getTime() - 1).toLocaleDateString('en-CA', { timeZone: APP_TIME_ZONE });
    return Math.round(Date.parse(`${ymd}T00:00:00Z`) / DAY_MS);
}

/** A qualificação vale durante todo o turno? Sem vencimento, sempre. */
export function qualificationCoversShift(expiresAt: Date | null, shift: { end: Date }): boolean {
    if (!expiresAt) return true;
    return expiryDayNumber(expiresAt) >= shiftLastDayNumber(shift);
}

/**
 * Bloqueia a escala quando a pessoa tem qualificações mas nenhuma vale no dia do turno. Quem nunca
 * teve nenhuma (ex.: coordenador sem certificação específica) não é bloqueado — não há o que checar.
 */
export async function assertQualifiedForShift(
    prisma: PrismaService,
    person: { userId: string; name: string },
    shift: { start: Date; end: Date },
): Promise<void> {
    const [externalCertifications, courseCertificates] = await Promise.all([
        prisma.externalCertification.findMany({ where: { userId: person.userId }, select: { expiresAt: true } }),
        prisma.certificate.findMany({
            where: { status: { not: CertificateStatus.REVOKED }, enrollment: { studentProfile: { userId: person.userId } } },
            select: { expiresAt: true },
        }),
    ]);

    const qualifications = [...externalCertifications, ...courseCertificates];
    if (qualifications.length === 0) return;
    if (qualifications.some((q) => qualificationCoversShift(q.expiresAt, shift))) return;

    // Todas têm vencimento (senão alguma cobriria): a que vence por último é a que mais se aproxima do turno.
    const latest = qualifications.reduce((best, q) => (q.expiresAt!.getTime() > best.getTime() ? q.expiresAt! : best), qualifications[0].expiresAt!);
    throw new ConflictException(
        `${person.name} não tem certificado ou certificação válido no dia do turno: o mais recente vence em ${formatAppDate(latest)}, ` +
            `antes do turno de ${formatAppDate(shift.start)}. É preciso renovar (reciclagem) antes de escalar.`,
    );
}
