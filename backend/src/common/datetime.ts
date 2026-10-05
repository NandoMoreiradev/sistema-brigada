// backend/src/common/datetime.ts
//
// Toda string de data/hora "solta" que chega do frontend (ex.: de um
// <input type="datetime-local">, sem timezone embutido, tipo
// "2026-01-15T10:30") representa a hora de parede de America/Sao_Paulo —
// não a hora local do processo Node. Usar `new Date(string)` direto faz o
// runtime interpretar essa string na timezone do SERVIDOR: se ele rodar em
// UTC (padrão em Railway/containers), o evento é gravado 3h adiantado em
// relação ao que o usuário digitou. `fromZonedTime` faz essa conversão
// explicitamente, então funciona igual não importa a timezone do host.

import { fromZonedTime } from 'date-fns-tz';

export const APP_TIME_ZONE = 'America/Sao_Paulo';

export function parseAppDateTime(value: string): Date;
export function parseAppDateTime(value: string | undefined): Date | undefined;
export function parseAppDateTime(value: string | undefined): Date | undefined {
    if (value === undefined) return undefined;
    return fromZonedTime(value, APP_TIME_ZONE);
}

/**
 * "15/03/2026" — data no fuso da aplicação, para textos de e-mail.
 *
 * Turmas criadas antes de `parseAppDateTime` passar a ser usada em CoursesService guardam a
 * data como meia-noite UTC exata (ex.: `2026-03-15T00:00:00.000Z`); no fuso do Brasil isso
 * viraria o dia anterior, então esse valor específico é lido como data "solta" em UTC.
 */
export function formatAppDate(value: Date): string {
    const isUtcMidnight = value.getUTCHours() === 0 && value.getUTCMinutes() === 0 && value.getUTCSeconds() === 0 && value.getUTCMilliseconds() === 0;
    return value.toLocaleDateString('pt-BR', { timeZone: isUtcMidnight ? 'UTC' : APP_TIME_ZONE });
}

/**
 * Hoje (no fuso da aplicação) como meia-noite UTC — o mesmo formato em que o Prisma devolve
 * colunas `@db.Date` (ex.: `ClassSession.date`), para comparar direto com elas.
 */
export function appTodayAsDateOnly(now = new Date()): Date {
    return new Date(`${now.toLocaleDateString('en-CA', { timeZone: APP_TIME_ZONE })}T00:00:00.000Z`);
}

/** "15/03/2026 às 08:00" — data e hora no fuso da aplicação, para textos de e-mail. */
export function formatAppDateTime(value: Date): string {
    const date = value.toLocaleDateString('pt-BR', { timeZone: APP_TIME_ZONE });
    const time = value.toLocaleTimeString('pt-BR', { timeZone: APP_TIME_ZONE, hour: '2-digit', minute: '2-digit' });
    return `${date} às ${time}`;
}
