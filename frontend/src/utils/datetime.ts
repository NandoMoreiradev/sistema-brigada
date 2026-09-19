// frontend/src/utils/datetime.ts
//
// Toda data de evento é exibida e editada na timezone da organização
// (America/Sao_Paulo), não na timezone do sistema operacional de quem está
// olhando a tela — evita que o app mostre um horário diferente do que o
// backend gravou (ver backend/src/common/datetime.ts, mesma convenção do
// outro lado). Isso importa mesmo em produção só-Brasil: um notebook
// configurado em outro fuso, ou um navegador com relógio errado, não deveria
// bagunçar o que aparece.

import { formatInTimeZone, toZonedTime } from 'date-fns-tz';
import { format } from 'date-fns';

export const APP_TIME_ZONE = 'America/Sao_Paulo';

/** Formata um ISO string (UTC) no fuso da organização, com o padrão de `date-fns`. */
export function formatAppDate(iso: string, pattern: string): string {
    return formatInTimeZone(new Date(iso), APP_TIME_ZONE, pattern);
}

/** Converte um ISO string (UTC) para o valor que um <input type="datetime-local"> espera, já no fuso da organização. */
export function toDateTimeLocalValue(iso: string | null | undefined): string {
    if (!iso) return '';
    return format(toZonedTime(new Date(iso), APP_TIME_ZONE), "yyyy-MM-dd'T'HH:mm");
}
