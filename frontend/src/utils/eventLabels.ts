// frontend/src/utils/eventLabels.ts
// Rótulos compartilhados entre Events.tsx (lista) e EventDetail.tsx (detalhe + edição).

import type { EventKind } from '@/services/events';
import type { EventStatus } from '@/types';

export const KIND_LABEL: Record<EventKind, string> = {
    ASSEMBLEIA: 'Assembleia',
    CONGRESSO: 'Congresso',
    ATUACAO_BRIGADA: 'Atuação de brigada',
    REUNIAO: 'Reunião',
};

export const STATUS_LABEL: Record<EventStatus, string> = {
    SCHEDULED: 'Agendado',
    ONGOING: 'Em andamento',
    COMPLETED: 'Concluído',
    CANCELLED: 'Cancelado',
};

export const STATUS_TONE: Record<EventStatus, 'neutral' | 'success' | 'info' | 'danger'> = {
    SCHEDULED: 'info',
    ONGOING: 'success',
    COMPLETED: 'neutral',
    CANCELLED: 'danger',
};

export const EVENT_STATUS_VALUES: EventStatus[] = ['SCHEDULED', 'ONGOING', 'COMPLETED', 'CANCELLED'];
