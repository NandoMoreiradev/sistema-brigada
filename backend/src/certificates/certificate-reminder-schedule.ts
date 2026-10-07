// backend/src/certificates/certificate-reminder-schedule.ts
//
// Regras puras (sem banco) de QUANDO um lembrete de vencimento é devido — usadas pelo
// envio de verdade (certificate-reminders.service.ts) e pela pré-visualização da tela de
// configuração, para as duas nunca divergirem.
//
// Contagem em dias de calendário no fuso da aplicação: "vence em 30 dias" é sobre a data
// que a pessoa vê no certificado, não sobre múltiplos de 24h a partir do horário de emissão.

import { APP_TIME_ZONE } from '../common/datetime';

export interface ReminderSchedule {
    /** Dias antes do vencimento (0 = no dia) */
    daysBefore: number[];
    /** Dias depois do vencimento */
    daysAfter: number[];
}

/**
 * Etapa "depois de vencer" só é enviada até esta quantidade de dias de atraso. Sem isso,
 * ligar "avisar 7 dias depois" disparava e-mail para certificados vencidos há anos.
 * Etapas "antes" não precisam: enquanto o certificado não venceu, o aviso ainda é útil.
 */
export const AFTER_STAGE_CATCH_UP_DAYS = 7;

const DAY_MS = 86_400_000;

/** Número do dia (calendário em America/Sao_Paulo) — só serve para subtrair um do outro. */
export function appDayNumber(date: Date): number {
    const ymd = date.toLocaleDateString('en-CA', { timeZone: APP_TIME_ZONE });
    return Math.round(Date.parse(`${ymd}T00:00:00Z`) / DAY_MS);
}

/** Dias de calendário de `now` até `expiresAt`: 0 = vence hoje, negativo = já venceu. */
export function daysUntilExpiration(expiresAt: Date, now: Date): number {
    return appDayNumber(expiresAt) - appDayNumber(now);
}

export function stageLabel(stage: string): string {
    const [kind, value] = stage.split(':');
    if (kind === 'manual') return 'Envio manual';
    const days = Number(value);
    if (kind === 'before') return days === 0 ? 'No dia do vencimento' : `${days} ${days === 1 ? 'dia' : 'dias'} antes`;
    return `${days} ${days === 1 ? 'dia' : 'dias'} depois de vencer`;
}

/**
 * A etapa que vale hoje, ou null. Com etapas 60/30/7 e faltando 25 dias, vale a de 30
 * (a mais recente já alcançada) — a de 60, se ficou para trás sem envio (academia ligou
 * depois, servidor fora do ar...), não é mais mandada: avisar "faltam 60 dias" com 25
 * faltando só confunde. Quem decide se a etapa já foi enviada é quem chama.
 */
export function dueStage(daysUntil: number, schedule: ReminderSchedule): string | null {
    if (daysUntil >= 0) {
        const reached = schedule.daysBefore.filter((d) => daysUntil <= d);
        return reached.length ? `before:${Math.min(...reached)}` : null;
    }

    const daysSince = -daysUntil;
    const reached = schedule.daysAfter.filter((d) => daysSince >= d);
    if (!reached.length) return null;
    const stageDays = Math.max(...reached);
    return daysSince - stageDays <= AFTER_STAGE_CATCH_UP_DAYS ? `after:${stageDays}` : null;
}

/**
 * Simula os próximos `horizonDays` dias: em que dia cada etapa ainda não enviada vai sair.
 * `alreadySent` = etapas com registro (enviadas, puladas ou em envio).
 */
export function upcomingStages(
    daysUntil: number,
    schedule: ReminderSchedule,
    alreadySent: ReadonlySet<string>,
    horizonDays: number,
): Array<{ dayOffset: number; stage: string }> {
    const sent = new Set(alreadySent);
    const result: Array<{ dayOffset: number; stage: string }> = [];
    for (let dayOffset = 0; dayOffset <= horizonDays; dayOffset++) {
        const stage = dueStage(daysUntil - dayOffset, schedule);
        if (stage && !sent.has(stage)) {
            result.push({ dayOffset, stage });
            sent.add(stage);
        }
    }
    return result;
}
