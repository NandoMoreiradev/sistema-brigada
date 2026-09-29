// frontend/src/pages/event-detail/useEventSchedule.ts
//
// Carrega evento + designações e monta o modelo único da escala (utils/schedule.ts). Todas as
// abas (lista, matriz, mapa, textos, impressão) usam este hook, então filtram e contam igual.

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { eventsApi, designationsApi, type DesignationStatus } from '@/services/events';
import { buildSchedule, DEFAULT_STATUSES } from '@/utils/schedule';

export function useEventSchedule(eventId: string, includeStatuses: DesignationStatus[] = DEFAULT_STATUSES) {
    const { data: event } = useQuery({ queryKey: ['events', eventId], queryFn: () => eventsApi.get(eventId) });
    const { data: designations } = useQuery({ queryKey: ['events', eventId, 'designations'], queryFn: () => designationsApi.list(eventId) });

    const shifts = useMemo(() => event?.operation?.shifts ?? [], [event]);
    const posts = useMemo(() => event?.operation?.posts ?? [], [event]);
    const statusKey = includeStatuses.join(',');

    const schedule = useMemo(
        () => buildSchedule({ shifts, posts, designations: designations ?? [], includeStatuses }),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [shifts, posts, designations, statusKey],
    );

    return { event, shifts, posts, designations: designations ?? [], schedule };
}
