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
