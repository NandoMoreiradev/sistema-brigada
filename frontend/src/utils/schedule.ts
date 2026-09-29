// frontend/src/utils/schedule.ts
//
// Modelo ÚNICO da escala de um evento: dia → turno → posto → pessoas. A matriz de cobertura, o
// mapa (tela, imagem PNG e impressão) e os textos copiados (grupo e por pessoa) derivam todos
// daqui, com as mesmas regras — assim uma pessoa que recusou some de todas as saídas ao mesmo
// tempo, e um turno nunca é mostrado misturado com outro.
//
// Funções puras (sem React/DOM) para poderem ser testadas.

import { format } from 'date-fns';
import type { Designation, DesignationStatus, EventFloorPlan, EventPost, EventShift } from '@/services/events';
import { formatAppDate } from '@/utils/datetime';

/** Quem conta na escala por padrão: quem recusou libera a vaga e não aparece em nenhuma saída. */
export const DEFAULT_STATUSES: DesignationStatus[] = ['PENDING', 'CONFIRMED'];

export interface Assignment {
    designationId: string;
    staffMemberId: string;
    userId: string;
    name: string;
    role: string;
    status: DesignationStatus;
    teamName: string | null;
}

/** vazio | parcial | completo | acima da capacidade | sem capacidade definida (com gente). */
export type CoverageState = 'empty' | 'partial' | 'full' | 'over' | 'open';

export interface PostSlot {
    /** `null` = pessoas escaladas sem posto. */
    post: EventPost | null;
    /** Planta do posto; só preenchida quando o evento tem mais de uma (senão os textos ficam como antes). */
    plan: EventFloorPlan | null;
    people: Assignment[];
    capacity: number | null;
    state: CoverageState;
}

export interface ShiftBlock {
    shift: EventShift;
    /** "08:00–12:00" no fuso do app. */
    range: string;
    /** "Manhã 08:00–12:00" (ou só o horário, se o nome já é o horário). */
    title: string;
    slots: PostSlot[];
    /** Total de pessoas escaladas neste turno (todos os postos). */
    total: number;
}

export interface DayBlock {
    /** yyyy-MM-dd no fuso do app. */
    key: string;
    /** 1, 2, 3… na ordem cronológica dos dias que têm turno. */
    index: number;
    /** "Dia 1 — sex 13/11". */
    label: string;
    shifts: ShiftBlock[];
}

export interface Schedule {
    days: DayBlock[];
    /** Plantas do evento, em ordem. Com 2 ou mais, textos e folhas passam a indicar a planta. */
    plans: EventFloorPlan[];
}

/** Só faz sentido falar em "planta" nas saídas quando há mais de uma. */
export function hasMultiplePlans(schedule: Pick<Schedule, 'plans'>): boolean {
    return schedule.plans.length > 1;
}

export function dayKeyOf(iso: string): string {
    return formatAppDate(iso, 'yyyy-MM-dd');
}

export function shiftRange(shift: Pick<EventShift, 'start' | 'end'>): string {
    return `${formatAppDate(shift.start, 'HH:mm')}–${formatAppDate(shift.end, 'HH:mm')}`;
}

/** "sex 13/11" a partir de yyyy-MM-dd (sem converter fuso: é uma data de calendário). */
export function shortDayLabel(dayKey: string): string {
    const [y, m, d] = dayKey.split('-').map(Number);
    // Abreviação fixa: o locale pt-BR do date-fns devolve o nome por extenso ("sexta").
    return `${WEEKDAYS[new Date(y, m - 1, d).getDay()]} ${format(new Date(y, m - 1, d), 'dd/MM')}`;
}

const WEEKDAYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

/** Turnos criados pela migração têm o próprio horário como nome ("08:00–18:00"). */
export function isRangeName(name: string): boolean {
    return /^\d{1,2}:\d{2}\s*[–-]\s*\d{1,2}:\d{2}$/.test(name.trim());
}

/** "Manhã 08:00–12:00" — ou só "08:00–18:00" quando o nome já é o horário (sem repetir). */
export function shiftTitle(name: string, range: string, style: 'space' | 'paren' = 'space'): string {
    if (isRangeName(name)) return range;
    return style === 'paren' ? `${name} (${range})` : `${name} ${range}`;
}

export function coverageState(count: number, capacity: number | null): CoverageState {
    if (capacity == null) return count > 0 ? 'open' : 'empty';
    if (count === 0) return 'empty';
    if (count < capacity) return 'partial';
    return count > capacity ? 'over' : 'full';
}

function toAssignment(d: Designation): Assignment {
    return {
        designationId: d.id,
        staffMemberId: d.staffMember.id,
        userId: d.staffMember.user.id,
        name: d.staffMember.user.name,
        role: d.role,
        status: d.status,
        teamName: d.team?.name ?? null,
    };
}

interface BuildInput {
    shifts: EventShift[];
    posts: EventPost[];
    designations: Designation[];
    floorPlans?: EventFloorPlan[];
    includeStatuses?: DesignationStatus[];
}

export function buildSchedule({ shifts, posts: rawPosts, designations, floorPlans = [], includeStatuses = DEFAULT_STATUSES }: BuildInput): Schedule {
    const plans = [...floorPlans].sort((a, b) => a.order - b.order);
    const multi = plans.length > 1;
    const planOf = (post: EventPost) => (multi ? (plans.find((p) => p.id === post.floorPlanId) ?? null) : null);
    // Com várias plantas os postos saem agrupados por planta (na ordem das abas); dentro dela, na ordem original.
    const planRank = (post: EventPost) => {
        const i = plans.findIndex((p) => p.id === post.floorPlanId);
        return i === -1 ? plans.length : i;
    };
    const posts = multi ? [...rawPosts].sort((a, b) => planRank(a) - planRank(b)) : rawPosts;
    const allowed = new Set(includeStatuses);
    const active = designations.filter((d) => allowed.has(d.status));

    const orderedShifts = [...shifts].sort((a, b) => +new Date(a.start) - +new Date(b.start) || +new Date(a.end) - +new Date(b.end));
    const dayKeys = [...new Set(orderedShifts.map((s) => dayKeyOf(s.start)))];

    const days: DayBlock[] = dayKeys.map((key, i) => ({
        key,
        index: i + 1,
        label: `Dia ${i + 1} — ${shortDayLabel(key)}`,
        shifts: orderedShifts
            .filter((s) => dayKeyOf(s.start) === key)
            .map((shift) => {
                const inShift = active.filter((d) => d.shiftId === shift.id);
                const slots: PostSlot[] = posts.map((post) => {
                    const people = inShift.filter((d) => d.post?.id === post.id).map(toAssignment);
                    return { post, plan: planOf(post), people, capacity: post.capacity, state: coverageState(people.length, post.capacity) };
                });
                const withoutPost = inShift.filter((d) => !d.post).map(toAssignment);
                if (withoutPost.length > 0) {
                    slots.push({ post: null, plan: null, people: withoutPost, capacity: null, state: 'open' });
                }
                const range = shiftRange(shift);
                return { shift, range, title: shiftTitle(shift.name, range), slots, total: inShift.length };
            }),
    }));

    return { days, plans };
}

/** Mantém só os turnos escolhidos (e só os dias que sobram). */
export function filterSchedule(schedule: Schedule, shiftIds: ReadonlySet<string>): Schedule {
    return {
        plans: schedule.plans,
        days: schedule.days
            .map((day) => ({ ...day, shifts: day.shifts.filter((s) => shiftIds.has(s.shift.id)) }))
            .filter((day) => day.shifts.length > 0),
    };
}

export function allShiftIds(schedule: Schedule): string[] {
    return schedule.days.flatMap((d) => d.shifts.map((s) => s.shift.id));
}

/** Pessoas distintas escaladas (para o texto individual), em ordem alfabética. */
export function listPeople(schedule: Schedule): { staffMemberId: string; name: string; count: number }[] {
    const map = new Map<string, { staffMemberId: string; name: string; count: number }>();
    for (const day of schedule.days) {
        for (const shift of day.shifts) {
            for (const slot of shift.slots) {
                for (const person of slot.people) {
                    const entry = map.get(person.staffMemberId) ?? { staffMemberId: person.staffMemberId, name: person.name, count: 0 };
                    entry.count += 1;
                    map.set(person.staffMemberId, entry);
                }
            }
        }
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}

/* ------------------------------------------------------------------------------------------ */
/* Textos (WhatsApp: *negrito*)                                                                */
/* ------------------------------------------------------------------------------------------ */

export interface TextOptions {
    /** Mostra "(Brigadista)" ao lado do nome. */
    showRoles?: boolean;
    /** Marca quem ainda não confirmou com "(pendente)". */
    markPending?: boolean;
    /** Lista também os postos sem ninguém ("— sem ninguém —"). Útil para a coordenação; ruído para o grupo. */
    showEmptyPosts?: boolean;
}

interface EventInfo {
    title: string;
    location?: string | null;
}

function personLabel(person: Assignment, { showRoles = true, markPending = true }: TextOptions): string {
    const role = showRoles && person.role ? ` (${person.role})` : '';
    const pending = markPending && person.status === 'PENDING' ? ' — pendente' : '';
    return `${person.name}${role}${pending}`;
}

/** Nomes de um posto: quem está numa equipe (dupla/trio) sai agrupado, os demais em sequência. */
function peopleLine(people: Assignment[], options: TextOptions): string {
    const teams = new Map<string, Assignment[]>();
    const solo: Assignment[] = [];
    for (const person of people) {
        if (person.teamName) teams.set(person.teamName, [...(teams.get(person.teamName) ?? []), person]);
        else solo.push(person);
    }
    const parts = [
        ...solo.map((p) => personLabel(p, options)),
        ...[...teams.entries()].map(([team, members]) => `${team}: ${members.map((m) => personLabel(m, options)).join(', ')}`),
    ];
    return parts.join('; ');
}

/** Escala inteira para mandar num grupo: dia → turno → posto → pessoas. */
export function buildGroupText(event: EventInfo, schedule: Schedule, options: TextOptions = {}): string {
    const lines: string[] = [`*${event.title}*`];
    if (event.location) lines.push(`Local: ${event.location}`);

    for (const day of schedule.days) {
        lines.push('', `*${day.label.toUpperCase()}*`);
        for (const shift of day.shifts) {
            lines.push('', `*${shiftTitle(shift.shift.name, shift.range, 'paren')}*`);
            const visibleSlots = shift.slots.filter((slot) => slot.people.length > 0 || (options.showEmptyPosts && slot.post));
            if (visibleSlots.length === 0) lines.push('• (ninguém escalado neste turno)');
            const multi = hasMultiplePlans(schedule);
            let currentPlan: string | null | undefined;
            for (const slot of visibleSlots) {
                if (multi) {
                    const planName = slot.plan?.name ?? null;
                    if (planName !== currentPlan) {
                        lines.push(`_${planName ?? 'Sem planta'}_`);
                        currentPlan = planName;
                    }
                }
                const name = slot.post ? slot.post.name : 'Sem posto';
                const need = slot.capacity != null ? ` [${slot.people.length}/${slot.capacity}]` : '';
                lines.push(slot.people.length > 0 ? `• *${name}*${need}: ${peopleLine(slot.people, options)}` : `• *${name}*${need}: — sem ninguém —`);
            }
        }
    }
    return lines.join('\n');
}

/** A escala de UMA pessoa (para mandar só para ela): os turnos dela, agrupados por dia. */
export function buildPersonText(event: EventInfo, schedule: Schedule, staffMemberId: string, options: TextOptions = {}): string {
    const mine = schedule.days
        .map((day) => ({
            day,
            items: day.shifts.flatMap((shift) =>
                shift.slots.flatMap((slot) =>
                    slot.people.filter((p) => p.staffMemberId === staffMemberId).map((person) => ({ shift, slot, person })),
                ),
            ),
        }))
        .filter((entry) => entry.items.length > 0);

    const firstName = mine[0]?.items[0]?.person.name.split(' ')[0] ?? '';
    const lines: string[] = [`Olá${firstName ? `, ${firstName}` : ''}! Sua escala em *${event.title}*${event.location ? ` (${event.location})` : ''}:`];

    for (const { day, items } of mine) {
        lines.push('', `*${day.label}*`);
        for (const { shift, slot, person } of items) {
            const planLabel = slot.plan && hasMultiplePlans(schedule) ? ` (${slot.plan.name})` : '';
            const where = slot.post ? `${slot.post.name}${planLabel}` : 'posto a definir';
            const role = options.showRoles !== false && person.role ? ` (${person.role})` : '';
            const team = person.teamName ? ` — ${person.teamName}` : '';
            const pending = options.markPending !== false && person.status === 'PENDING' ? ' — aguardando sua confirmação' : '';
            lines.push(`• ${shiftTitle(shift.shift.name, shift.range, 'paren')} — ${where}${role}${team}${pending}`);
        }
    }
    if (mine.length === 0) lines.push('', 'Você não está escalado(a) nos turnos selecionados.');
    return lines.join('\n');
}

/* ------------------------------------------------------------------------------------------ */
/* Posicionamento dos cartões de nomes sobre o mapa                                            */
/* ------------------------------------------------------------------------------------------ */

export interface LabelInput {
    id: string;
    /** Posição do pino, em px dentro do mapa. */
    px: number;
    py: number;
    /** Tamanho do cartão, em px. */
    w: number;
    h: number;
}

export interface LabelPlacement {
    id: string;
    x: number;
    y: number;
    w: number;
    h: number;
    /** Ponto do cartão mais próximo do pino (para a linha de ligação). */
    anchorX: number;
    anchorY: number;
}

interface Rect {
    x: number;
    y: number;
    w: number;
    h: number;
}

function overlapArea(a: Rect, b: Rect): number {
    const dx = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
    const dy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
    return dx > 0 && dy > 0 ? dx * dy : 0;
}

function outOfBounds(r: Rect, width: number, height: number): number {
    const over = (v: number) => Math.max(0, v);
    return over(-r.x) * r.h + over(r.x + r.w - width) * r.h + over(-r.y) * r.w + over(r.y + r.h - height) * r.w;
}

/**
 * Coloca um cartão de nomes ao lado de cada pino evitando que cartões (e pinos) se sobreponham.
 * Guloso e determinístico: para cada pino tenta direita, esquerda, abaixo e acima, com pequenos
 * deslocamentos, e fica com a opção de menor sobreposição/estouro da borda.
 */
export function layoutLabels(items: LabelInput[], canvas: { width: number; height: number }, pinRadius = 14, gap = 6): LabelPlacement[] {
    const placed: LabelPlacement[] = [];
    const pins = items.map((i) => ({ x: i.px - pinRadius, y: i.py - pinRadius, w: pinRadius * 2, h: pinRadius * 2, id: i.id }));
    const ordered = [...items].sort((a, b) => a.py - b.py || a.px - b.px);

    for (const item of ordered) {
        const { px, py, w, h } = item;
        const r = pinRadius + gap;
        const candidates: Rect[] = [];
        const dys = [0, -h * 0.5, h * 0.5, -h, h];
        const dxs = [0, -w * 0.5, w * 0.5];
        for (const dy of dys) candidates.push({ x: px + r, y: py - h / 2 + dy, w, h });
        for (const dy of dys) candidates.push({ x: px - r - w, y: py - h / 2 + dy, w, h });
        for (const dx of dxs) candidates.push({ x: px - w / 2 + dx, y: py + r, w, h });
        for (const dx of dxs) candidates.push({ x: px - w / 2 + dx, y: py - r - h, w, h });

        let best = candidates[0];
        let bestScore = Infinity;
        for (const candidate of candidates) {
            let score = outOfBounds(candidate, canvas.width, canvas.height) * 4;
            for (const p of placed) score += overlapArea(candidate, p) * 3;
            for (const pin of pins) if (pin.id !== item.id) score += overlapArea(candidate, pin) * 6;
            score += overlapArea(candidate, pins.find((pin) => pin.id === item.id)!) * 10;
            if (score < bestScore) {
                bestScore = score;
                best = candidate;
                if (score === 0) break;
            }
        }

        // Mantém dentro do mapa (o custo acima só desestimula; aqui garantimos).
        const x = Math.min(Math.max(0, best.x), Math.max(0, canvas.width - best.w));
        const y = Math.min(Math.max(0, best.y), Math.max(0, canvas.height - best.h));
        placed.push({
            id: item.id,
            x,
            y,
            w: best.w,
            h: best.h,
            anchorX: Math.min(Math.max(px, x), x + best.w),
            anchorY: Math.min(Math.max(py, y), y + best.h),
        });
    }
    return items.map((i) => placed.find((p) => p.id === i.id)!);
}
