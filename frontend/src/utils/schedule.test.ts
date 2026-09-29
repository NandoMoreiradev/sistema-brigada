import { describe, expect, it } from 'vitest';
import type { Designation, EventPost, EventShift } from '@/services/events';
import { buildGroupText, buildPersonText, buildSchedule, coverageState, filterSchedule, layoutLabels, listPeople } from './schedule';

// 08:00 em São Paulo (UTC-3) = 11:00Z
const shift = (id: string, name: string, day: string, startH: number, endH: number): EventShift => ({
    id,
    name,
    start: `${day}T${String(startH + 3).padStart(2, '0')}:00:00.000Z`,
    end: `${day}T${String(endH + 3).padStart(2, '0')}:00:00.000Z`,
});

const shifts: EventShift[] = [
    shift('d1m', 'Manhã', '2026-11-13', 8, 12),
    shift('d1t', 'Tarde', '2026-11-13', 12, 18),
    shift('d2m', 'Manhã', '2026-11-14', 8, 12),
];

const posts: EventPost[] = [
    { id: 'pA', name: 'Portão A', capacity: 2, notes: null, posX: 0.2, posY: 0.3 },
    { id: 'pB', name: 'Palco', capacity: 1, notes: null, posX: 0.7, posY: 0.4 },
];

const des = (id: string, name: string, shiftId: string, post: EventPost | null, status: Designation['status'] = 'CONFIRMED', team: string | null = null): Designation => ({
    id,
    role: 'Brigadista',
    shiftStart: '',
    shiftEnd: '',
    status,
    shiftId,
    shift: null,
    staffMember: { id: `sm_${name}`, user: { id: `u_${name}`, name, email: `${name}@x.com` } },
    post,
    team: team ? { id: `t_${team}`, name: team } : null,
});

const designations: Designation[] = [
    des('1', 'João Silva', 'd1m', posts[0]),
    des('2', 'Maria Souza', 'd1m', posts[0]),
    des('3', 'Pedro Lima', 'd1m', posts[1], 'PENDING'),
    des('4', 'João Silva', 'd1t', posts[1]),
    des('5', 'Ana Recusou', 'd1m', posts[1], 'DECLINED'),
    des('6', 'Maria Souza', 'd2m', posts[0]),
    des('7', 'Rui Sem Posto', 'd2m', null),
];

const event = { title: 'Congresso Regional', location: 'Ginásio Central' };

describe('buildSchedule', () => {
    const schedule = buildSchedule({ shifts, posts, designations });

    it('agrupa em dias e turnos, em ordem cronológica', () => {
        expect(schedule.days.map((d) => d.label)).toEqual(['Dia 1 — sex 13/11', 'Dia 2 — sáb 14/11']);
        expect(schedule.days[0].shifts.map((s) => `${s.shift.name} ${s.range}`)).toEqual(['Manhã 08:00–12:00', 'Tarde 12:00–18:00']);
    });

    it('quem recusou não conta em nenhum posto', () => {
        const palcoManha = schedule.days[0].shifts[0].slots.find((s) => s.post?.id === 'pB')!;
        expect(palcoManha.people.map((p) => p.name)).toEqual(['Pedro Lima']);
        expect(schedule.days[0].shifts[0].total).toBe(3);
    });

    it('um turno nunca mistura pessoas de outro turno/dia', () => {
        const portaoTarde = schedule.days[0].shifts[1].slots.find((s) => s.post?.id === 'pA')!;
        expect(portaoTarde.people).toHaveLength(0);
        expect(portaoTarde.state).toBe('empty');
    });

    it('marca a cobertura por posto e turno', () => {
        expect(schedule.days[0].shifts[0].slots[0].state).toBe('full');
        expect(schedule.days[1].shifts[0].slots[0].state).toBe('partial');
    });

    it('junta pessoas sem posto num bloco "sem posto"', () => {
        const noPost = schedule.days[1].shifts[0].slots.find((s) => s.post === null)!;
        expect(noPost.people.map((p) => p.name)).toEqual(['Rui Sem Posto']);
    });

    it('inclui recusados só quando pedido', () => {
        const all = buildSchedule({ shifts, posts, designations, includeStatuses: ['PENDING', 'CONFIRMED', 'DECLINED'] });
        expect(all.days[0].shifts[0].total).toBe(4);
    });

    it('filtra turnos e descarta dias que ficam vazios', () => {
        const only = filterSchedule(schedule, new Set(['d2m']));
        expect(only.days).toHaveLength(1);
        expect(only.days[0].shifts[0].shift.id).toBe('d2m');
    });
});

describe('coverageState', () => {
    it('cobre os casos', () => {
        expect(coverageState(0, 2)).toBe('empty');
        expect(coverageState(1, 2)).toBe('partial');
        expect(coverageState(2, 2)).toBe('full');
        expect(coverageState(3, 2)).toBe('over');
        expect(coverageState(2, null)).toBe('open');
        expect(coverageState(0, null)).toBe('empty');
    });
});

describe('buildGroupText', () => {
    const schedule = buildSchedule({ shifts, posts, designations });
    const text = buildGroupText(event, schedule, { showEmptyPosts: true });

    it('organiza por dia, turno e posto, sem os recusados', () => {
        expect(text).toContain('*Congresso Regional*');
        expect(text).toContain('*DIA 1 — SEX 13/11*');
        expect(text).toContain('*Manhã (08:00–12:00)*');
        expect(text).toContain('• *Portão A* [2/2]: João Silva (Brigadista); Maria Souza (Brigadista)');
        expect(text).not.toContain('Ana Recusou');
    });

    it('marca pendente e posto vazio', () => {
        expect(text).toContain('Pedro Lima (Brigadista) — pendente');
        expect(text).toContain('• *Portão A* [0/2]: — sem ninguém —');
    });

    it('por padrão não lista postos sem ninguém', () => {
        const lean = buildGroupText(event, schedule);
        expect(lean).not.toContain('sem ninguém');
        expect(lean).toContain('• *Portão A* [2/2]');
    });

    it('agrupa duplas', () => {
        const withTeam = buildSchedule({ shifts, posts, designations: [des('9', 'Lia', 'd1m', posts[0], 'CONFIRMED', 'Dupla 1'), des('10', 'Leo', 'd1m', posts[0], 'CONFIRMED', 'Dupla 1')] });
        expect(buildGroupText(event, withTeam)).toContain('Dupla 1: Lia (Brigadista), Leo (Brigadista)');
    });
});

describe('buildPersonText', () => {
    const schedule = buildSchedule({ shifts, posts, designations });

    it('lista só os turnos da pessoa, por dia', () => {
        const text = buildPersonText(event, schedule, 'sm_João Silva');
        expect(text).toContain('Olá, João!');
        expect(text).toContain('*Dia 1 — sex 13/11*');
        expect(text).toContain('• Manhã (08:00–12:00) — Portão A (Brigadista)');
        expect(text).toContain('• Tarde (12:00–18:00) — Palco (Brigadista)');
        expect(text).not.toContain('Maria');
    });

    it('avisa pendência e falta de escala', () => {
        expect(buildPersonText(event, schedule, 'sm_Pedro Lima')).toContain('aguardando sua confirmação');
        expect(buildPersonText(event, schedule, 'sm_Ninguém')).toContain('não está escalado');
    });
});

describe('listPeople', () => {
    it('conta turnos por pessoa, em ordem alfabética', () => {
        const schedule = buildSchedule({ shifts, posts, designations });
        const people = listPeople(schedule);
        expect(people.map((p) => p.name)).toEqual(['João Silva', 'Maria Souza', 'Pedro Lima', 'Rui Sem Posto']);
        expect(people.find((p) => p.name === 'João Silva')!.count).toBe(2);
    });
});

describe('layoutLabels', () => {
    const overlaps = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) =>
        a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

    it('não sobrepõe cartões de pinos próximos', () => {
        const items = [
            { id: 'a', px: 300, py: 200, w: 150, h: 60 },
            { id: 'b', px: 320, py: 215, w: 150, h: 60 },
            { id: 'c', px: 340, py: 230, w: 150, h: 60 },
            { id: 'd', px: 500, py: 210, w: 150, h: 60 },
        ];
        const out = layoutLabels(items, { width: 1000, height: 600 });
        for (let i = 0; i < out.length; i++) for (let j = i + 1; j < out.length; j++) expect(overlaps(out[i], out[j])).toBe(false);
    });

    it('mantém os cartões dentro do mapa, mesmo com pinos na borda', () => {
        const out = layoutLabels([{ id: 'a', px: 990, py: 5, w: 150, h: 60 }, { id: 'b', px: 5, py: 595, w: 150, h: 60 }], { width: 1000, height: 600 });
        for (const box of out) {
            expect(box.x).toBeGreaterThanOrEqual(0);
            expect(box.y).toBeGreaterThanOrEqual(0);
            expect(box.x + box.w).toBeLessThanOrEqual(1000);
            expect(box.y + box.h).toBeLessThanOrEqual(600);
        }
    });

    it('devolve na mesma ordem da entrada', () => {
        const out = layoutLabels([{ id: 'z', px: 800, py: 500, w: 100, h: 40 }, { id: 'a', px: 100, py: 100, w: 100, h: 40 }], { width: 1000, height: 600 });
        expect(out.map((o) => o.id)).toEqual(['z', 'a']);
    });
});
