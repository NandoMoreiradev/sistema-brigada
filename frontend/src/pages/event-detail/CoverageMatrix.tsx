// frontend/src/pages/event-detail/CoverageMatrix.tsx
//
// Matriz de cobertura: postos (linhas) × turnos (colunas, agrupados por dia). É a visão que mostra
// os buracos e os excessos de uma vez — e cada célula é um atalho para escalar alguém ali.

import styled from 'styled-components';
import { Plus } from 'lucide-react';
import { isRangeName, type CoverageState, type Schedule } from '@/utils/schedule';

const TINT: Record<CoverageState, string> = {
    empty: '#fff0e6',
    partial: '#fff9db',
    full: '#ebfbee',
    over: '#f3f0ff',
    open: '#e7f5ff',
};

const INK: Record<CoverageState, string> = {
    empty: '#d9480f',
    partial: '#b36b00',
    full: '#2b8a3e',
    over: '#5f3dc4',
    open: '#1864ab',
};

const Scroll = styled.div`
    overflow-x: auto;
    border: 1px solid ${({ theme }) => theme.colors.borderLight};
    border-radius: ${({ theme }) => theme.radii.md};
    background: ${({ theme }) => theme.colors.white};
`;

const Grid = styled.table`
    border-collapse: separate;
    border-spacing: 0;
    font-size: 0.75rem;
    min-width: 100%;

    th,
    td {
        border-right: 1px solid ${({ theme }) => theme.colors.borderLight};
        border-bottom: 1px solid ${({ theme }) => theme.colors.borderLight};
        padding: 0.4rem 0.55rem;
        vertical-align: top;
        text-align: left;
    }

    thead th {
        background: ${({ theme }) => theme.colors.lightGray};
        font-size: 0.6875rem;
        text-transform: uppercase;
        letter-spacing: 0.02em;
        color: ${({ theme }) => theme.colors.textMedium};
    }

    th.corner,
    td.post {
        position: sticky;
        left: 0;
        z-index: 1;
        background: ${({ theme }) => theme.colors.white};
        min-width: 140px;
    }

    thead th.corner {
        background: ${({ theme }) => theme.colors.lightGray};
    }

    td.post strong {
        display: block;
        font-size: 0.8125rem;
    }

    td.post span {
        color: ${({ theme }) => theme.colors.textMuted};
    }

    .day {
        text-align: center;
        border-left: 2px solid ${({ theme }) => theme.colors.border};
    }

    .day-start {
        border-left: 2px solid ${({ theme }) => theme.colors.border};
    }
`;

const Cell = styled.button<{ $state: CoverageState; $clickable: boolean }>`
    display: block;
    width: 100%;
    min-width: 120px;
    text-align: left;
    border: none;
    border-radius: 4px;
    padding: 0.3rem 0.4rem;
    background: ${({ $state }) => TINT[$state]};
    color: inherit;
    font: inherit;
    cursor: ${({ $clickable }) => ($clickable ? 'pointer' : 'default')};

    &:hover {
        outline: ${({ $clickable, $state }) => ($clickable ? `2px solid ${INK[$state]}` : 'none')};
    }

    .count {
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-weight: 700;
        color: ${({ $state }) => INK[$state]};
        margin-bottom: 2px;
    }

    .name {
        display: block;
        line-height: 1.35;
    }

    .pending {
        color: #868e96;
    }
`;

interface CoverageMatrixProps {
    schedule: Schedule;
    canManage: boolean;
    /** Clique numa célula: escalar alguém naquele turno/posto. */
    onCellClick: (shiftId: string, postId: string | null) => void;
}

export function CoverageMatrix({ schedule, canManage, onCellClick }: CoverageMatrixProps) {
    const shifts = schedule.days.flatMap((day) => day.shifts.map((block) => ({ day, block })));
    if (shifts.length === 0) return null;

    // Linhas: todos os postos (na ordem de cadastro) + "Sem posto" se alguém estiver escalado sem posto.
    const first = shifts[0].block;
    const rows = first.slots.map((slot) => slot.post?.id ?? null);
    const hasNoPostRow = shifts.some(({ block }) => block.slots.some((slot) => slot.post === null));
    const postRows = rows.filter((id): id is string => id !== null);
    const allRows: (string | null)[] = hasNoPostRow ? [...postRows, null] : postRows;

    const emptyCells = shifts.reduce((sum, { block }) => sum + block.slots.filter((s) => s.post && s.state === 'empty').length, 0);

    return (
        <div>
            {emptyCells > 0 && (
                <div style={{ marginBottom: '0.5rem', fontSize: '0.8125rem', color: '#d9480f', fontWeight: 600 }}>
                    {emptyCells} posto(s)/turno(s) sem ninguém escalado.
                </div>
            )}
            <Scroll>
                <Grid>
                    <thead>
                        <tr>
                            <th className="corner" rowSpan={2}>Posto</th>
                            {schedule.days.map((day) => (
                                <th key={day.key} className="day" colSpan={day.shifts.length}>{day.label}</th>
                            ))}
                        </tr>
                        <tr>
                            {shifts.map(({ day, block }, i) => (
                                <th key={block.shift.id} className={i === 0 || shifts[i - 1].day.key !== day.key ? 'day-start' : undefined}>
                                    {isRangeName(block.shift.name) ? (
                                        block.range
                                    ) : (
                                        <>
                                            {block.shift.name}
                                            <br />
                                            <span style={{ fontWeight: 500 }}>{block.range}</span>
                                        </>
                                    )}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {allRows.map((postId) => {
                            const label = postId === null ? { name: 'Sem posto', cap: null } : (() => {
                                const slot = first.slots.find((s) => s.post?.id === postId)!;
                                return { name: slot.post!.name, cap: slot.capacity };
                            })();
                            return (
                                <tr key={postId ?? 'none'}>
                                    <td className="post">
                                        <strong>{label.name}</strong>
                                        {label.cap != null && <span>precisa de {label.cap}</span>}
                                    </td>
                                    {shifts.map(({ day, block }, i) => {
                                        const slot = block.slots.find((s) => (s.post?.id ?? null) === postId);
                                        const people = slot?.people ?? [];
                                        const state: CoverageState = slot?.state ?? 'empty';
                                        const clickable = canManage && postId !== null;
                                        return (
                                            <td key={block.shift.id} className={i === 0 || shifts[i - 1].day.key !== day.key ? 'day-start' : undefined}>
                                                <Cell
                                                    type="button"
                                                    $state={state}
                                                    $clickable={clickable}
                                                    disabled={!clickable}
                                                    onClick={() => onCellClick(block.shift.id, postId)}
                                                    aria-label={`${label.name}, ${day.label}, ${block.shift.name}: ${people.length} pessoa(s)`}
                                                >
                                                    <span className="count">
                                                        {label.cap != null ? `${people.length}/${label.cap}` : people.length}
                                                        {clickable && people.length < (label.cap ?? 1) && <Plus size={12} />}
                                                    </span>
                                                    {people.map((p) => (
                                                        <span key={p.designationId} className={`name${p.status === 'PENDING' ? ' pending' : ''}`}>
                                                            {p.name}
                                                            {p.status === 'PENDING' ? ' *' : ''}
                                                        </span>
                                                    ))}
                                                </Cell>
                                            </td>
                                        );
                                    })}
                                </tr>
                            );
                        })}
                        <tr>
                            <td className="post"><strong>Total escalado</strong></td>
                            {shifts.map(({ day, block }, i) => (
                                <td key={block.shift.id} className={i === 0 || shifts[i - 1].day.key !== day.key ? 'day-start' : undefined}>
                                    <strong>{block.total}</strong>
                                </td>
                            ))}
                        </tr>
                    </tbody>
                </Grid>
            </Scroll>
            <div style={{ marginTop: '0.4rem', fontSize: '0.7rem', color: '#6c757d' }}>* aguardando confirmação · quem recusou não aparece aqui.</div>
        </div>
    );
}
