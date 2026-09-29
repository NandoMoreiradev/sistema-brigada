// frontend/src/pages/event-detail/mapPins.ts
//
// Converte o modelo da escala (utils/schedule.ts) nos pinos/cartões do mapa para UM turno ou para a
// visão do dia (um resumo por turno dentro do cartão do posto).

import type { EventPost } from '@/services/events';
import type { CoverageState, PostSlot, Schedule, ShiftBlock } from '@/utils/schedule';
import type { MapPinData, MapPinLine } from './MapSheet';

export type MapSelection = { kind: 'shift'; shiftId: string } | { kind: 'day'; dayKey: string };

export interface PinOptions {
    showRoles: boolean;
}

function personLine(person: PostSlot['people'][number], { showRoles }: PinOptions): MapPinLine {
    return { text: showRoles && person.role ? `${person.name} (${person.role})` : person.name, pending: person.status === 'PENDING' };
}

/** Pior situação vence: um turno vazio deixa o pino do dia "vazio". */
function worstState(states: CoverageState[]): CoverageState {
    for (const state of ['empty', 'partial', 'over'] as const) if (states.includes(state)) return state;
    return states.includes('full') ? 'full' : 'open';
}

export function findShiftBlock(schedule: Schedule, shiftId: string): ShiftBlock | undefined {
    return schedule.days.flatMap((d) => d.shifts).find((s) => s.shift.id === shiftId);
}

export function buildPins(posts: EventPost[], schedule: Schedule, selection: MapSelection | null, options: PinOptions): MapPinData[] {
    const placed = posts.filter((p) => p.posX != null && p.posY != null);
    const hasShifts = schedule.days.length > 0;

    if (!selection || !hasShifts) {
        return placed.map((post) => ({ id: post.id, name: post.name, posX: post.posX!, posY: post.posY!, badge: post.capacity ? `0/${post.capacity}` : '·', state: 'open', lines: [] }));
    }

    if (selection.kind === 'shift') {
        const block = findShiftBlock(schedule, selection.shiftId);
        return placed.map((post) => {
            const slot = block?.slots.find((s) => s.post?.id === post.id);
            const people = slot?.people ?? [];
            return {
                id: post.id,
                name: post.name,
                posX: post.posX!,
                posY: post.posY!,
                badge: post.capacity != null ? `${people.length}/${post.capacity}` : `${people.length}`,
                state: slot?.state ?? 'empty',
                lines: people.length > 0 ? people.map((p) => personLine(p, options)) : [{ text: '— vazio —', warn: true }],
            };
        });
    }

    const day = schedule.days.find((d) => d.key === selection.dayKey);
    const blocks = day?.shifts ?? [];
    return placed.map((post) => {
        const slots = blocks.map((b) => ({ block: b, slot: b.slots.find((s) => s.post?.id === post.id) }));
        const covered = slots.filter(({ slot }) => (slot?.people.length ?? 0) > 0).length;
        return {
            id: post.id,
            name: post.name,
            posX: post.posX!,
            posY: post.posY!,
            badge: `${covered}/${blocks.length}`,
            state: worstState(slots.map(({ slot }) => slot?.state ?? 'empty')),
            lines: slots.map(({ block, slot }) => {
                const names = (slot?.people ?? []).map((p) => (options.showRoles && p.role ? `${p.name} (${p.role})` : p.name));
                return names.length > 0 ? { text: `${block.shift.name}: ${names.join(', ')}` } : { text: `${block.shift.name}: — vazio —`, warn: true };
            }),
        };
    });
}
