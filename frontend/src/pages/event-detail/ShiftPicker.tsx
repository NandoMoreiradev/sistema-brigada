// frontend/src/pages/event-detail/ShiftPicker.tsx
//
// Seleção de turnos agrupados por dia (com "dia todo"). Usado ao escalar (vários turnos de uma
// vez), ao exportar texto e ao imprimir mapas.

import styled from 'styled-components';
import type { DayBlock } from '@/utils/schedule';

const Day = styled.div`
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    padding: 0.5rem 0.65rem;
    border: 1px solid ${({ theme }) => theme.colors.borderLight};
    border-radius: ${({ theme }) => theme.radii.sm};
`;

const DayHeader = styled.label`
    display: flex;
    align-items: center;
    gap: 0.45rem;
    font-size: 0.8125rem;
    font-weight: 700;
    cursor: pointer;
`;

const Chips = styled.div`
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    padding-left: 1.4rem;
`;

const Chip = styled.label<{ $checked: boolean }>`
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.25rem 0.6rem;
    border-radius: ${({ theme }) => theme.radii.pill};
    border: 1px solid ${({ theme, $checked }) => ($checked ? theme.colors.primary : theme.colors.border)};
    background: ${({ theme, $checked }) => ($checked ? theme.colors.primaryLight : theme.colors.white)};
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;

    input {
        display: none;
    }

    small {
        font-weight: 500;
        color: ${({ theme }) => theme.colors.textMuted};
    }
`;

interface ShiftPickerProps {
    days: DayBlock[];
    value: string[];
    onChange: (next: string[]) => void;
    /** Mostra "(N pessoas)" em cada turno. */
    showCounts?: boolean;
}

export function ShiftPicker({ days, value, onChange, showCounts }: ShiftPickerProps) {
    const selected = new Set(value);

    const toggle = (id: string) => {
        const next = new Set(selected);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        onChange([...next]);
    };

    const toggleDay = (day: DayBlock) => {
        const ids = day.shifts.map((s) => s.shift.id);
        const allSelected = ids.every((id) => selected.has(id));
        const next = new Set(selected);
        ids.forEach((id) => (allSelected ? next.delete(id) : next.add(id)));
        onChange([...next]);
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {days.map((day) => {
                const allSelected = day.shifts.every((s) => selected.has(s.shift.id));
                const someSelected = day.shifts.some((s) => selected.has(s.shift.id));
                return (
                    <Day key={day.key}>
                        <DayHeader>
                            <input
                                type="checkbox"
                                checked={allSelected}
                                ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected; }}
                                onChange={() => toggleDay(day)}
                            />
                            {day.label} <span style={{ fontWeight: 500, fontSize: '0.75rem', color: '#6c757d' }}>· dia todo</span>
                        </DayHeader>
                        <Chips>
                            {day.shifts.map(({ shift, title, total }) => (
                                <Chip key={shift.id} $checked={selected.has(shift.id)}>
                                    <input type="checkbox" checked={selected.has(shift.id)} onChange={() => toggle(shift.id)} />
                                    {title}
                                    {showCounts && <small>({total})</small>}
                                </Chip>
                            ))}
                        </Chips>
                    </Day>
                );
            })}
        </div>
    );
}
