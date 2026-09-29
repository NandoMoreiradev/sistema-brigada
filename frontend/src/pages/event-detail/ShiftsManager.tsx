// frontend/src/pages/event-detail/ShiftsManager.tsx
//
// Turnos do evento (iguais para todos os postos). Em cima: criar vários de uma vez (cada modelo de
// turno repetido em cada dia). Embaixo: os turnos existentes, editáveis — remarcar um turno remarca
// a escala de todo mundo que está nele. Mostra lacuna/sobreposição entre turnos seguidos do mesmo
// dia (passagem de turno: o ideal é encostar, sem lacuna).

import { useMemo, useState } from 'react';
import styled from 'styled-components';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Save } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input, HelpText } from '@/components/ui/FormField';
import { eventShiftsApi, type EventShift, type ShiftTemplate } from '@/services/events';
import { toast } from '@/utils/toast';
import { apiErrorMessage } from '@/utils/apiError';
import { toDateTimeLocalValue } from '@/utils/datetime';
import { dayKeyOf, shortDayLabel, shiftRange } from '@/utils/schedule';

const Section = styled.section`
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    padding: 0.75rem 0;

    & + & {
        border-top: 1px solid ${({ theme }) => theme.colors.borderLight};
    }

    h3 {
        margin: 0;
        font-size: 0.8125rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.03em;
        color: ${({ theme }) => theme.colors.textMedium};
    }
`;

const Row = styled.div`
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.25fr) minmax(0, 1.25fr) auto;
    gap: 0.5rem;
    align-items: center;

    @media (max-width: 640px) {
        grid-template-columns: 1fr 1fr;
    }
`;

const Notice = styled.div<{ $tone: 'warn' | 'info' }>`
    font-size: 0.75rem;
    padding: 0.2rem 0.5rem;
    border-radius: ${({ theme }) => theme.radii.sm};
    background: ${({ $tone }) => ($tone === 'warn' ? '#fff4e6' : '#e7f5ff')};
    color: ${({ $tone }) => ($tone === 'warn' ? '#d9480f' : '#1864ab')};
`;

const DayChip = styled.label<{ $on: boolean }>`
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.25rem 0.6rem;
    border-radius: ${({ theme }) => theme.radii.pill};
    border: 1px solid ${({ theme, $on }) => ($on ? theme.colors.primary : theme.colors.border)};
    background: ${({ theme, $on }) => ($on ? theme.colors.primaryLight : theme.colors.white)};
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;

    input {
        display: none;
    }
`;

const QUICK_TEMPLATES: ShiftTemplate[] = [
    { name: 'Manhã', startTime: '08:00', endTime: '12:00' },
    { name: 'Tarde', startTime: '12:00', endTime: '18:00' },
    { name: 'Noite', startTime: '18:00', endTime: '22:00' },
];

/** yyyy-MM-dd de cada dia entre início e fim do evento (no máximo 14, para não gerar lista absurda). */
function eventDays(startIso: string, endIso: string | null): string[] {
    const first = dayKeyOf(startIso);
    const last = endIso ? dayKeyOf(endIso) : first;
    const days: string[] = [];
    const cursor = new Date(`${first}T12:00:00Z`);
    while (days.length < 14) {
        const key = cursor.toISOString().slice(0, 10);
        days.push(key);
        if (key >= last) break;
        cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    return days;
}

function minutesBetween(aIso: string, bIso: string): number {
    return Math.round((+new Date(bIso) - +new Date(aIso)) / 60000);
}

interface ShiftsManagerProps {
    eventId: string;
    eventStart: string;
    eventEnd: string | null;
    shifts: EventShift[];
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function ShiftsManager({ eventId, eventStart, eventEnd, shifts, open, onOpenChange }: ShiftsManagerProps) {
    const queryClient = useQueryClient();
    const availableDays = useMemo(() => eventDays(eventStart, eventEnd), [eventStart, eventEnd]);
    const [days, setDays] = useState<string[]>(availableDays);
    const [extraDay, setExtraDay] = useState('');
    const [templates, setTemplates] = useState<ShiftTemplate[]>(QUICK_TEMPLATES.slice(0, 2));

    const invalidate = () => {
        queryClient.invalidateQueries({ queryKey: ['events', eventId] });
        queryClient.invalidateQueries({ queryKey: ['events', eventId, 'designations'] });
    };

    const createMutation = useMutation({
        mutationFn: () => eventShiftsApi.createBulk(eventId, { days, shifts: templates }),
        onSuccess: (result) => {
            toast.success(result.skipped > 0 ? `${result.created} turno(s) criado(s); ${result.skipped} já existiam.` : `${result.created} turno(s) criado(s).`);
            invalidate();
        },
        onError: (error: unknown) => toast.error(apiErrorMessage(error, 'Não foi possível criar os turnos.')),
    });

    const grouped = useMemo(() => {
        const map = new Map<string, EventShift[]>();
        [...shifts].sort((a, b) => +new Date(a.start) - +new Date(b.start)).forEach((s) => {
            const key = dayKeyOf(s.start);
            map.set(key, [...(map.get(key) ?? []), s]);
        });
        return [...map.entries()];
    }, [shifts]);

    const allDays = [...new Set([...availableDays, ...days])].sort();
    const updateTemplate = (i: number, patch: Partial<ShiftTemplate>) => setTemplates((current) => current.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));
    const canCreate = days.length > 0 && templates.length > 0 && templates.every((t) => t.name.trim() && t.startTime && t.endTime);

    return (
        <Modal open={open} onOpenChange={onOpenChange} title="Turnos do evento" width="800px">
            <Section>
                <h3>Criar turnos</h3>
                <HelpText>Os turnos são os mesmos para todos os postos. Cada pessoa é escalada em um ou mais turnos (ex.: manhã num dia, o dia todo em outro).</HelpText>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', alignItems: 'center' }}>
                    {allDays.map((day) => (
                        <DayChip key={day} $on={days.includes(day)}>
                            <input type="checkbox" checked={days.includes(day)} onChange={() => setDays((c) => (c.includes(day) ? c.filter((d) => d !== day) : [...c, day]))} />
                            {shortDayLabel(day)}
                        </DayChip>
                    ))}
                    <Input type="date" value={extraDay} onChange={(e) => setExtraDay(e.target.value)} style={{ width: 150, padding: '0.3rem 0.5rem' }} aria-label="Adicionar outro dia" />
                    <Button
                        type="button"
                        $variant="ghost"
                        disabled={!extraDay}
                        onClick={() => { setDays((c) => [...new Set([...c, extraDay])]); setExtraDay(''); }}
                    >
                        <Plus size={14} /> Dia
                    </Button>
                </div>

                {templates.map((template, i) => (
                    <Row key={i}>
                        <Input aria-label="Nome do turno" placeholder="Nome (ex.: Manhã)" value={template.name} onChange={(e) => updateTemplate(i, { name: e.target.value })} />
                        <Input aria-label="Início" type="time" value={template.startTime} onChange={(e) => updateTemplate(i, { startTime: e.target.value })} />
                        <Input aria-label="Fim" type="time" value={template.endTime} onChange={(e) => updateTemplate(i, { endTime: e.target.value })} />
                        <Button type="button" $variant="ghost" aria-label="Remover modelo" onClick={() => setTemplates((c) => c.filter((_, idx) => idx !== i))}>
                            <Trash2 size={14} />
                        </Button>
                    </Row>
                ))}
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    {QUICK_TEMPLATES.filter((q) => !templates.some((t) => t.name === q.name)).map((q) => (
                        <Button key={q.name} type="button" $variant="secondary" onClick={() => setTemplates((c) => [...c, q])}>
                            <Plus size={14} /> {q.name} {q.startTime}–{q.endTime}
                        </Button>
                    ))}
                    <Button type="button" $variant="secondary" onClick={() => setTemplates((c) => [...c, { name: '', startTime: '08:00', endTime: '12:00' }])}>
                        <Plus size={14} /> Outro turno
                    </Button>
                    <div style={{ flex: 1 }} />
                    <Button type="button" disabled={!canCreate || createMutation.isPending} onClick={() => createMutation.mutate()}>
                        {createMutation.isPending ? 'Criando...' : `Criar ${days.length * templates.length} turno(s)`}
                    </Button>
                </div>
                <HelpText>Fim igual ou antes do início significa que o turno termina no dia seguinte (ex.: Noite 22:00–02:00).</HelpText>
            </Section>

            <Section>
                <h3>Turnos do evento ({shifts.length})</h3>
                {grouped.length === 0 && <HelpText>Nenhum turno criado ainda.</HelpText>}
                {grouped.map(([day, dayShifts]) => (
                    <div key={day} style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        <strong style={{ fontSize: '0.8125rem' }}>{shortDayLabel(day)}</strong>
                        {dayShifts.map((shift, i) => (
                            <div key={shift.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                {i > 0 && <TransitionNotice previous={dayShifts[i - 1]} next={shift} />}
                                <ShiftRow eventId={eventId} shift={shift} onChanged={invalidate} />
                            </div>
                        ))}
                    </div>
                ))}
            </Section>
        </Modal>
    );
}

function TransitionNotice({ previous, next }: { previous: EventShift; next: EventShift }) {
    const gap = minutesBetween(previous.end, next.start);
    if (gap === 0) return null;
    return gap > 0 ? (
        <Notice $tone="warn">
            Lacuna de {gap} min entre {previous.name} e {next.name} ({shiftRange(previous).split('–')[1]} → {shiftRange(next).split('–')[0]}): nenhum posto tem cobertura nesse intervalo.
        </Notice>
    ) : (
        <Notice $tone="info">Sobreposição de {-gap} min entre {previous.name} e {next.name} (passagem de turno).</Notice>
    );
}

function ShiftRow({ eventId, shift, onChanged }: { eventId: string; shift: EventShift; onChanged: () => void }) {
    const [name, setName] = useState(shift.name);
    const [start, setStart] = useState(toDateTimeLocalValue(shift.start));
    const [end, setEnd] = useState(toDateTimeLocalValue(shift.end));
    const designations = shift._count?.designations ?? 0;
    const dirty = name !== shift.name || start !== toDateTimeLocalValue(shift.start) || end !== toDateTimeLocalValue(shift.end);

    const saveMutation = useMutation({
        mutationFn: () => eventShiftsApi.update(eventId, shift.id, { name, start, end }),
        onSuccess: () => { toast.success('Turno atualizado.'); onChanged(); },
        onError: (error: unknown) => toast.error(apiErrorMessage(error, 'Não foi possível atualizar o turno.')),
    });

    const removeMutation = useMutation({
        mutationFn: () => eventShiftsApi.remove(eventId, shift.id),
        onSuccess: () => { toast.success('Turno removido.'); onChanged(); },
        onError: (error: unknown) => toast.error(apiErrorMessage(error, 'Não foi possível remover o turno.')),
    });

    return (
        <Row>
            <Input aria-label="Nome do turno" value={name} onChange={(e) => setName(e.target.value)} />
            <Input aria-label="Início do turno" type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
            <Input aria-label="Fim do turno" type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} />
            <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                {designations > 0 && <span style={{ fontSize: '0.7rem', color: '#6c757d', whiteSpace: 'nowrap' }}>{designations} escalado(s)</span>}
                <Button type="button" $variant="ghost" disabled={!dirty || saveMutation.isPending} onClick={() => saveMutation.mutate()} aria-label="Salvar turno" title={dirty ? 'Salvar (remarca a escala de quem está no turno)' : 'Sem alterações'}>
                    <Save size={14} />
                </Button>
                <Button
                    type="button"
                    $variant="ghost"
                    disabled={designations > 0 || removeMutation.isPending}
                    onClick={() => { if (window.confirm(`Remover o turno "${shift.name}"?`)) removeMutation.mutate(); }}
                    aria-label="Remover turno"
                    title={designations > 0 ? 'Tem gente escalada: mova ou remova as escalas antes' : 'Remover turno'}
                >
                    <Trash2 size={14} />
                </Button>
            </div>
        </Row>
    );
}
