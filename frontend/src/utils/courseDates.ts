// frontend/src/utils/courseDates.ts
//
// Datas de turma/aula são "datas soltas" (sem hora relevante). Antes, o frontend fazia
// `format(new Date(iso), 'dd/MM/yyyy')`, que converte para o fuso do navegador: uma aula de
// 15/03 (guardada como 2026-03-15T00:00:00Z) aparecia como 14/03 para quem está no Brasil.
// Estas funções leem a data como o usuário a digitou.

import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const APP_TIME_ZONE = 'America/Sao_Paulo';
const dayInAppZone = new Intl.DateTimeFormat('en-CA', { timeZone: APP_TIME_ZONE });

/**
 * "yyyy-MM-dd" do dia que o usuário escolheu.
 * - Meia-noite UTC exata (`@db.Date` das aulas e turmas antigas): o próprio dia UTC.
 * - Qualquer outro instante (turmas novas, gravadas à meia-noite de São Paulo): o dia em São Paulo.
 */
export function toDateOnly(iso: string): string {
    const date = new Date(iso);
    const isUtcMidnight = date.getUTCHours() === 0 && date.getUTCMinutes() === 0 && date.getUTCSeconds() === 0 && date.getUTCMilliseconds() === 0;
    return isUtcMidnight ? date.toISOString().slice(0, 10) : dayInAppZone.format(date);
}

/** "15/03/2026" */
export function formatDateOnly(iso: string): string {
    const [year, month, day] = toDateOnly(iso).split('-');
    return `${day}/${month}/${year}`;
}

/** "seg, 15/03/2026" */
export function formatDateWithWeekday(iso: string): string {
    const [year, month, day] = toDateOnly(iso).split('-').map(Number);
    return format(new Date(year, month - 1, day), 'EEE, dd/MM/yyyy', { locale: ptBR });
}

export type SessionTiming = 'past' | 'today' | 'upcoming';

/** Compara o dia da aula com "hoje" no fuso da aplicação (yyyy-MM-dd ordena como texto). */
export function sessionTiming(iso: string): SessionTiming {
    const day = toDateOnly(iso);
    const today = dayInAppZone.format(new Date());
    if (day === today) return 'today';
    return day < today ? 'past' : 'upcoming';
}
