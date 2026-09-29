// frontend/src/pages/event-detail/ExportModal.tsx
//
// Texto da escala para WhatsApp, em dois formatos: para o GRUPO (escala inteira: dia → turno →
// posto → pessoas) e por PESSOA (só os turnos de cada um). Escolhe-se quais turnos entram; quem
// recusou nunca entra, e quem ainda não confirmou vem marcado como "pendente".

import { useMemo, useState } from 'react';
import { Copy, Printer } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Field, Label, Select, Textarea, HelpText, CheckboxField } from '@/components/ui/FormField';
import type { AppEvent, Designation } from '@/services/events';
import { toast } from '@/utils/toast';
import { allShiftIds, buildGroupText, buildPersonText, buildSchedule, filterSchedule, listPeople, type TextOptions } from '@/utils/schedule';
import { FilterChip } from '@/pages/course-detail/styles';
import { ShiftPicker } from './ShiftPicker';

interface ExportModalProps {
    event: AppEvent;
    designations: Designation[];
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Imprime a lista dos turnos escolhidos (o pai monta as folhas). */
    onPrintList: (shiftIds: string[]) => void;
}

async function copy(text: string, success: string) {
    try {
        await navigator.clipboard.writeText(text);
        toast.success(success);
    } catch {
        toast.error('Não foi possível copiar. Selecione o texto e copie manualmente.');
    }
}

export function ExportModal({ event, designations, open, onOpenChange, onPrintList }: ExportModalProps) {
    const shifts = useMemo(() => event.operation?.shifts ?? [], [event]);
    const posts = useMemo(() => event.operation?.posts ?? [], [event]);

    const [mode, setMode] = useState<'group' | 'person'>('group');
    const [includePending, setIncludePending] = useState(true);
    const [showRoles, setShowRoles] = useState(true);
    const [showEmptyPosts, setShowEmptyPosts] = useState(false);
    const [shiftIds, setShiftIds] = useState<string[] | null>(null);
    const [personId, setPersonId] = useState('');

    const full = useMemo(
        () => buildSchedule({ shifts, posts, designations, includeStatuses: includePending ? ['PENDING', 'CONFIRMED'] : ['CONFIRMED'] }),
        [shifts, posts, designations, includePending],
    );
    const selectedIds = shiftIds ?? allShiftIds(full);
    const schedule = useMemo(() => filterSchedule(full, new Set(selectedIds)), [full, selectedIds]);
    const people = useMemo(() => listPeople(schedule), [schedule]);
    const options: TextOptions = { showRoles, markPending: true, showEmptyPosts };
    const info = { title: event.title, location: event.location };

    const effectivePerson = people.some((p) => p.staffMemberId === personId) ? personId : people[0]?.staffMemberId ?? '';
    const text = mode === 'group' ? buildGroupText(info, schedule, options) : effectivePerson ? buildPersonText(info, schedule, effectivePerson, options) : '';
    const everyone = people.map((p) => `——— ${p.name} ———\n${buildPersonText(info, schedule, p.staffMemberId, options)}`).join('\n\n');

    return (
        <Modal open={open} onOpenChange={onOpenChange} title="Exportar escala" width="720px">
            {shifts.length === 0 ? (
                <HelpText>Crie os turnos do evento e escale as pessoas para exportar a escala.</HelpText>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                        <FilterChip type="button" $active={mode === 'group'} onClick={() => setMode('group')}>Para o grupo (escala inteira)</FilterChip>
                        <FilterChip type="button" $active={mode === 'person'} onClick={() => setMode('person')}>Por pessoa</FilterChip>
                    </div>

                    <Field>
                        <Label>Turnos incluídos</Label>
                        <ShiftPicker days={full.days} value={selectedIds} onChange={setShiftIds} showCounts />
                    </Field>

                    <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap' }}>
                        <CheckboxField style={{ fontWeight: 500 }}>
                            <input type="checkbox" checked={includePending} onChange={(e) => setIncludePending(e.target.checked)} />
                            Incluir quem ainda não confirmou (marcado como pendente)
                        </CheckboxField>
                        <CheckboxField style={{ fontWeight: 500 }}>
                            <input type="checkbox" checked={showRoles} onChange={(e) => setShowRoles(e.target.checked)} />
                            Mostrar funções
                        </CheckboxField>
                        {mode === 'group' && (
                            <CheckboxField style={{ fontWeight: 500 }}>
                                <input type="checkbox" checked={showEmptyPosts} onChange={(e) => setShowEmptyPosts(e.target.checked)} />
                                Listar postos sem ninguém
                            </CheckboxField>
                        )}
                    </div>
                    <HelpText>Quem recusou a escala nunca aparece.</HelpText>

                    {mode === 'person' && (
                        <Field>
                            <Label htmlFor="export-person">Pessoa</Label>
                            <Select id="export-person" value={effectivePerson} onChange={(e) => setPersonId(e.target.value)} disabled={people.length === 0}>
                                {people.map((p) => (
                                    <option key={p.staffMemberId} value={p.staffMemberId}>{p.name} ({p.count} turno{p.count === 1 ? '' : 's'})</option>
                                ))}
                            </Select>
                        </Field>
                    )}

                    <Field>
                        <Label htmlFor="export-text">Texto</Label>
                        <Textarea id="export-text" readOnly rows={12} value={text || 'Nenhuma pessoa escalada nos turnos selecionados.'} style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.75rem' }} />
                    </Field>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <Button type="button" $variant="secondary" disabled={selectedIds.length === 0} onClick={() => { onOpenChange(false); onPrintList(selectedIds); }}>
                            <Printer size={14} /> Imprimir lista
                        </Button>
                        {mode === 'person' && (
                            <Button type="button" $variant="secondary" disabled={people.length === 0} onClick={() => copy(everyone, `Textos de ${people.length} pessoa(s) copiados.`)}>
                                <Copy size={14} /> Copiar de todos
                            </Button>
                        )}
                        <Button type="button" disabled={!text} onClick={() => copy(text, mode === 'group' ? 'Escala copiada — já pode colar no grupo.' : 'Texto copiado — já pode enviar.')}>
                            <Copy size={14} /> Copiar texto
                        </Button>
                    </div>
                </div>
            )}
        </Modal>
    );
}
