// frontend/src/pages/event-detail/ScheduleTab.tsx
//
// Aba "Escala" (assembleia/congresso). Duas visões dos mesmos dados: LISTA (quem está onde, com
// status e ações) e COBERTURA (matriz postos × turnos, mostra buracos e excessos). Escalar é por
// turno: uma pessoa pode ser marcada em vários turnos de uma vez (manhã de um dia, dia todo em
// outro...). Texto e impressão saem do mesmo modelo do mapa (utils/schedule.ts).

import { useMemo, useState } from 'react';
import styled from 'styled-components';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Copy, Printer, Clock, Share2, ChevronDown, User } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ActionMenu, MoreButton } from '@/components/ui/ActionMenu';
import { Segmented } from '@/components/ui/Segmented';
import { PillSelect } from '@/components/ui/PillSelect';
import { Modal } from '@/components/ui/Modal';
import { Field, Label, Input, Select, Form, FormActions, HelpText } from '@/components/ui/FormField';
import { Table, TableWrapper, Thead, Tr, Th, Td, EmptyState, Badge } from '@/components/ui/Table';
import { designationsApi, type Designation, type DesignationStatus } from '@/services/events';
import { staffApi } from '@/services/staff';
import { toast } from '@/utils/toast';
import { apiErrorMessage } from '@/utils/apiError';
import { useAuth } from '@/contexts/AuthContext';
import { hasPermission } from '@/utils/permissions';
import { buildSchedule, filterSchedule, shiftRange, shiftTitle, dayKeyOf, shortDayLabel, type Schedule } from '@/utils/schedule';
import { ScrollX } from '@/pages/course-detail/styles';
import { useEventSchedule } from './useEventSchedule';
import { CoverageMatrix } from './CoverageMatrix';
import { ExportModal } from './ExportModal';
import { ShiftPicker } from './ShiftPicker';
import { ShiftsManager } from './ShiftsManager';
import { PrintPortal } from './PrintPortal';

const STATUS_LABEL: Record<DesignationStatus, string> = { PENDING: 'Pendente', CONFIRMED: 'Confirmada', DECLINED: 'Recusada' };
const STATUS_TONE: Record<DesignationStatus, 'warning' | 'success' | 'danger'> = { PENDING: 'warning', CONFIRMED: 'success', DECLINED: 'danger' };

const CheckList = styled.div`
    max-height: 200px;
    overflow-y: auto;
    border: 1px solid ${({ theme }) => theme.colors.borderLight};
    border-radius: ${({ theme }) => theme.radii.sm};
    padding: 0.5rem 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    font-size: 0.8125rem;
`;

const CheckListHeader = styled.div`
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.35rem;

    button {
        background: none;
        border: none;
        color: ${({ theme }) => theme.colors.primary};
        font-size: 0.75rem;
        font-weight: 600;
        cursor: pointer;
        padding: 0;
    }
`;

const Toolbar = styled.div`
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.5rem 1rem;
    margin-bottom: 0.75rem;
`;

const PrintDoc = styled.div`
    width: 100%;
    color: #000;
    background: #fff;
    font-size: 12px;

    h1 {
        margin: 0;
        font-size: 18px;
    }

    .sub {
        margin: 2px 0 10px;
        color: #495057;
    }

    .day {
        break-after: page;
        page-break-after: always;
    }

    .day:last-child {
        break-after: auto;
        page-break-after: auto;
    }

    h2 {
        margin: 0 0 6px;
        padding: 3px 6px;
        background: #e9ecef;
        font-size: 14px;
    }

    h3 {
        margin: 10px 0 4px;
        font-size: 13px;
    }

    table {
        width: 100%;
        border-collapse: collapse;
        break-inside: avoid;
    }

    th,
    td {
        border: 1px solid #868e96;
        padding: 3px 6px;
        text-align: left;
        vertical-align: top;
    }

    th {
        background: #f1f3f5;
        width: 26%;
    }

    .pending {
        color: #6c757d;
    }

    .stamp {
        margin-top: 8px;
        font-size: 10px;
        color: #495057;
    }
`;

interface CreateFormData {
    role: string;
    postId: string;
    teamName: string;
}

interface EditFormData {
    staffMemberId: string;
    role: string;
    shiftId: string;
    postId: string;
}

export function ScheduleTab({ eventId }: { eventId: string }) {
    const queryClient = useQueryClient();
    const { user } = useAuth();
    // Criar/editar escala exige `events:manage`; quem só vê o evento vê a escala em leitura.
    const canManage = hasPermission(user, 'events:manage');

    const { event, shifts, posts, designations, schedule } = useEventSchedule(eventId);
    const { data: staff } = useQuery({ queryKey: ['staff'], queryFn: () => staffApi.list(), enabled: canManage });
    const activeStaff = (staff ?? []).filter((s) => s.status === 'ACTIVE');

    const [view, setView] = useState<'list' | 'coverage'>('list');
    const [dayFilter, setDayFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState<'all' | DesignationStatus>('all');
    const [createOpen, setCreateOpen] = useState(false);
    const [editing, setEditing] = useState<Designation | null>(null);
    const [shiftsOpen, setShiftsOpen] = useState(false);
    const [exportOpen, setExportOpen] = useState(false);
    const [exportMode, setExportMode] = useState<'group' | 'person'>('group');
    const [printIds, setPrintIds] = useState<string[] | null>(null);
    const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([]);
    const [selectedShiftIds, setSelectedShiftIds] = useState<string[]>([]);
    const [asTeam, setAsTeam] = useState(false);

    const { register, handleSubmit, reset } = useForm<CreateFormData>();
    const editForm = useForm<EditFormData>();

    const invalidate = () => {
        queryClient.invalidateQueries({ queryKey: ['events', eventId, 'designations'] });
        queryClient.invalidateQueries({ queryKey: ['events', eventId] });
    };

    const createMutation = useMutation({
        mutationFn: (input: CreateFormData) =>
            designationsApi.createBulk(eventId, {
                staffMemberIds: selectedStaffIds,
                role: input.role,
                shiftIds: selectedShiftIds,
                postId: input.postId || undefined,
                asTeam: asTeam && selectedStaffIds.length >= 2,
                teamName: input.teamName || undefined,
            }),
        onSuccess: (created) => {
            toast.success(created.length > 1 ? `${created.length} designações criadas.` : 'Designação criada.');
            invalidate();
            setCreateOpen(false);
        },
        onError: (error: unknown) => toast.error(apiErrorMessage(error, 'Não foi possível criar a designação.')),
    });

    const statusMutation = useMutation({
        mutationFn: ({ designationId, status }: { designationId: string; status: DesignationStatus }) => designationsApi.updateStatus(eventId, designationId, status),
        onSuccess: invalidate,
        onError: (error: unknown) => toast.error(apiErrorMessage(error, 'Não foi possível atualizar.')),
    });

    const removeMutation = useMutation({
        mutationFn: (designationId: string) => designationsApi.remove(eventId, designationId),
        onSuccess: () => { toast.success('Designação removida.'); invalidate(); },
        onError: (error: unknown) => toast.error(apiErrorMessage(error, 'Não foi possível remover a designação.')),
    });

    const updateMutation = useMutation({
        mutationFn: (input: EditFormData) =>
            designationsApi.update(eventId, editing!.id, {
                staffMemberId: input.staffMemberId,
                role: input.role,
                shiftId: input.shiftId,
                // `null` tira a pessoa do posto (antes, esvaziar o campo mantinha o posto antigo).
                postId: input.postId || null,
            }),
        onSuccess: () => { toast.success('Designação atualizada.'); invalidate(); setEditing(null); },
        onError: (error: unknown) => toast.error(apiErrorMessage(error, 'Não foi possível atualizar a designação.')),
    });

    /** Abre o modal de escalar; a matriz já entrega turno e posto preenchidos. */
    const openCreate = (prefill?: { shiftId?: string; postId?: string | null }) => {
        reset({ role: '', postId: prefill?.postId ?? '', teamName: '' });
        setSelectedStaffIds([]);
        setSelectedShiftIds(prefill?.shiftId ? [prefill.shiftId] : []);
        setAsTeam(false);
        setCreateOpen(true);
    };

    const openEdit = (d: Designation) => {
        editForm.reset({ staffMemberId: d.staffMember.id, role: d.role, shiftId: d.shiftId ?? '', postId: d.post?.id ?? '' });
        setEditing(d);
    };

    const shiftById = useMemo(() => new Map(shifts.map((s) => [s.id, s])), [shifts]);
    /** Dia (ex.: "sáb 26/09") e turno ("Manhã 08:00–12:00") para as duas linhas da coluna Turno. */
    const shiftParts = (d: Designation) => {
        const shift = d.shiftId ? shiftById.get(d.shiftId) : undefined;
        return shift
            ? { day: shortDayLabel(dayKeyOf(shift.start)), title: shiftTitle(shift.name, shiftRange(shift)) }
            : { day: d.shiftStart.slice(0, 10).split('-').reverse().join('/'), title: '(sem turno)' };
    };

    const listed = useMemo(() => {
        const startOf = (d: Designation) => +new Date(d.shift?.start ?? d.shiftStart);
        return designations
            .filter((d) => statusFilter === 'all' || d.status === statusFilter)
            .filter((d) => dayFilter === 'all' || dayKeyOf(d.shift?.start ?? d.shiftStart) === dayFilter)
            .sort((a, b) => startOf(a) - startOf(b) || (a.post?.name ?? '~').localeCompare(b.post?.name ?? '~', 'pt-BR') || a.staffMember.user.name.localeCompare(b.staffMember.user.name, 'pt-BR'));
    }, [designations, statusFilter, dayFilter]);

    const counts = useMemo(() => {
        const base = { all: designations.length, PENDING: 0, CONFIRMED: 0, DECLINED: 0 };
        designations.forEach((d) => { base[d.status] += 1; });
        return base;
    }, [designations]);

    const hasDesignations = designations.length > 0;
    const printSchedule: Schedule | null = useMemo(
        () => (printIds ? filterSchedule(buildSchedule({ shifts, posts, designations }), new Set(printIds)) : null),
        [printIds, shifts, posts, designations],
    );

    return (
        <>
            <Toolbar>
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    {canManage && (
                        <Button onClick={() => openCreate()}><Plus size={16} /> Nova designação</Button>
                    )}
                    <Segmented
                        ariaLabel="Visão da escala"
                        value={view}
                        onChange={setView}
                        options={[{ value: 'list', label: 'Lista' }, { value: 'coverage', label: 'Cobertura' }]}
                    />
                </div>
                <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                    <ActionMenu
                        trigger={<Button $variant="secondary" disabled={!hasDesignations}><Share2 size={14} /> Exportar <ChevronDown size={14} /></Button>}
                        entries={[
                            { label: 'Copiar para o grupo', icon: <Copy size={14} />, hint: 'escala inteira', onSelect: () => { setExportMode('group'); setExportOpen(true); } },
                            { label: 'Copiar por pessoa', icon: <User size={14} />, hint: 'só os turnos de cada um', onSelect: () => { setExportMode('person'); setExportOpen(true); } },
                            { type: 'separator' },
                            { label: 'Imprimir lista', icon: <Printer size={14} />, onSelect: () => setPrintIds(schedule.days.flatMap((d) => d.shifts.map((s) => s.shift.id))) },
                        ]}
                    />
                    {canManage && (
                        <Button $variant="ghost" onClick={() => setShiftsOpen(true)} title="Criar e editar os turnos do evento"><Clock size={14} /> Turnos ({shifts.length})</Button>
                    )}
                </div>
            </Toolbar>

            {shifts.length === 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', padding: '0.6rem 0.8rem', marginBottom: '0.75rem', background: '#fff4e6', borderRadius: 8, fontSize: '0.8125rem', color: '#d9480f' }}>
                    <span>Este evento ainda não tem turnos.{canManage ? ' Crie os turnos (ex.: Manhã e Tarde de cada dia) para poder escalar as pessoas.' : ''}</span>
                    {canManage && <Button $variant="secondary" onClick={() => setShiftsOpen(true)}>Criar turnos</Button>}
                </div>
            )}

            {view === 'coverage' ? (
                schedule.days.length === 0 ? (
                    <EmptyState>Crie os turnos do evento para ver a cobertura dos postos.</EmptyState>
                ) : posts.length === 0 && !hasDesignations ? (
                    <EmptyState>Cadastre os postos na aba Mapa para ver a cobertura.</EmptyState>
                ) : (
                    <CoverageMatrix schedule={schedule} canManage={canManage && shifts.length > 0} onCellClick={(shiftId, postId) => openCreate({ shiftId, postId })} />
                )
            ) : (
                <>
                    {designations.length > 0 && (
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.6rem' }}>
                            {/* Com um dia só, filtrar por dia não faz sentido: o seletor some. */}
                            {schedule.days.length > 1 && (
                                <Select aria-label="Filtrar por dia" value={dayFilter} onChange={(e) => setDayFilter(e.target.value)} style={{ width: 'auto', padding: '0.4rem 0.6rem', fontSize: '0.8125rem' }}>
                                    <option value="all">Todos os dias</option>
                                    {schedule.days.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
                                </Select>
                            )}
                            <Select aria-label="Filtrar por situação" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as 'all' | DesignationStatus)} style={{ width: 'auto', padding: '0.4rem 0.6rem', fontSize: '0.8125rem' }}>
                                <option value="all">Todas as situações ({counts.all})</option>
                                <option value="PENDING">Pendentes ({counts.PENDING})</option>
                                <option value="CONFIRMED">Confirmadas ({counts.CONFIRMED})</option>
                                <option value="DECLINED">Recusadas ({counts.DECLINED})</option>
                            </Select>
                        </div>
                    )}
                    <TableWrapper>
                        <ScrollX>
                            <Table>
                                <Thead>
                                    <tr>
                                        <Th>Turno</Th>
                                        <Th>Posto</Th>
                                        <Th>Brigadista</Th>
                                        <Th>Equipe</Th>
                                        <Th>Situação</Th>
                                        {canManage && <Th style={{ width: 1 }} aria-label="Ações"></Th>}
                                    </tr>
                                </Thead>
                                <tbody>
                                    {listed.map((d) => {
                                        const parts = shiftParts(d);
                                        return (
                                            <Tr key={d.id} style={d.status === 'DECLINED' ? { opacity: 0.6 } : undefined}>
                                                <Td style={{ whiteSpace: 'nowrap' }}>
                                                    <strong>{parts.day}</strong>
                                                    <div style={{ fontSize: '0.75rem', color: '#6c757d' }}>{parts.title}</div>
                                                </Td>
                                                <Td>{d.post?.name ?? '—'}</Td>
                                                <Td>
                                                    <strong>{d.staffMember.user.name}</strong>
                                                    <div style={{ fontSize: '0.75rem', color: '#6c757d' }}>{d.role}</div>
                                                </Td>
                                                <Td style={{ whiteSpace: 'nowrap' }}>{d.team ? <Badge $tone="info">{d.team.name}</Badge> : '—'}</Td>
                                                <Td style={{ whiteSpace: 'nowrap' }}>
                                                    {/* updateStatus só deixa quem tem events:manage OU é o próprio staff alterar. */}
                                                    {canManage || d.staffMember.user.id === user?.id ? (
                                                        <PillSelect
                                                            $tone={STATUS_TONE[d.status]}
                                                            aria-label={`Situação de ${d.staffMember.user.name}`}
                                                            value={d.status}
                                                            onChange={(e) => statusMutation.mutate({ designationId: d.id, status: e.target.value as DesignationStatus })}
                                                        >
                                                            <option value="PENDING">Pendente</option>
                                                            <option value="CONFIRMED">Confirmada</option>
                                                            <option value="DECLINED">Recusada</option>
                                                        </PillSelect>
                                                    ) : (
                                                        <Badge $tone={STATUS_TONE[d.status]}>{STATUS_LABEL[d.status]}</Badge>
                                                    )}
                                                </Td>
                                                {canManage && (
                                                    <Td>
                                                        <ActionMenu
                                                            trigger={<MoreButton label={`Ações de ${d.staffMember.user.name}`} />}
                                                            entries={[
                                                                { label: 'Editar', icon: <Pencil size={14} />, onSelect: () => openEdit(d) },
                                                                {
                                                                    label: 'Remover',
                                                                    icon: <Trash2 size={14} />,
                                                                    danger: true,
                                                                    onSelect: () => { if (window.confirm(`Remover a designação de ${d.staffMember.user.name}?`)) removeMutation.mutate(d.id); },
                                                                },
                                                            ]}
                                                        />
                                                    </Td>
                                                )}
                                            </Tr>
                                        );
                                    })}
                                </tbody>
                            </Table>
                        </ScrollX>
                        {designations.length === 0 && <EmptyState>Nenhuma designação criada ainda.</EmptyState>}
                        {designations.length > 0 && listed.length === 0 && <EmptyState>Nenhuma designação com esse filtro.</EmptyState>}
                    </TableWrapper>
                </>
            )}

            {/* Nova designação: pessoas × turnos */}
            <Modal open={createOpen} onOpenChange={setCreateOpen} title="Nova designação" width="660px">
                <Form onSubmit={handleSubmit((data) => createMutation.mutate(data))}>
                    <Field>
                        <CheckListHeader>
                            <Label>Brigadistas ({selectedStaffIds.length} selecionado{selectedStaffIds.length === 1 ? '' : 's'})</Label>
                            <div style={{ display: 'flex', gap: '0.75rem' }}>
                                <button type="button" onClick={() => setSelectedStaffIds(activeStaff.map((s) => s.id))}>Selecionar todos</button>
                                <button type="button" onClick={() => setSelectedStaffIds([])}>Limpar</button>
                            </div>
                        </CheckListHeader>
                        <CheckList>
                            {activeStaff.map((s) => (
                                <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                                    <input
                                        type="checkbox"
                                        checked={selectedStaffIds.includes(s.id)}
                                        onChange={() => setSelectedStaffIds((prev) => (prev.includes(s.id) ? prev.filter((x) => x !== s.id) : [...prev, s.id]))}
                                    />
                                    {s.user.name}
                                </label>
                            ))}
                            {activeStaff.length === 0 && <span>Nenhum brigadista ativo cadastrado.</span>}
                        </CheckList>
                    </Field>

                    <Field>
                        <Label htmlFor="des-role">Função no evento</Label>
                        <Input id="des-role" placeholder="ex: Brigadista, Bombeiro Civil, Coordenador" {...register('role', { required: true })} />
                    </Field>

                    <Field>
                        <Label>Turnos ({selectedShiftIds.length} selecionado{selectedShiftIds.length === 1 ? '' : 's'})</Label>
                        {schedule.days.length === 0 ? (
                            <HelpText>
                                O evento não tem turnos.{' '}
                                <button type="button" style={{ background: 'none', border: 'none', color: '#007bff', cursor: 'pointer', padding: 0, fontWeight: 600 }} onClick={() => setShiftsOpen(true)}>Criar turnos</button>
                            </HelpText>
                        ) : (
                            <ShiftPicker days={schedule.days} value={selectedShiftIds} onChange={setSelectedShiftIds} />
                        )}
                        <HelpText>Marque todos os turnos em que a(s) pessoa(s) atua. Turnos seguidos (manhã e tarde) podem ser marcados juntos.</HelpText>
                    </Field>

                    <Field>
                        <Label htmlFor="des-post">Posto de atuação (opcional)</Label>
                        <Select id="des-post" {...register('postId')}>
                            <option value="">Sem posto definido</option>
                            {posts.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </Select>
                    </Field>

                    {selectedStaffIds.length >= 2 && (
                        <>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8125rem' }}>
                                <input type="checkbox" checked={asTeam} onChange={(e) => setAsTeam(e.target.checked)} />
                                Tratar como equipe (dupla/trio) — agrupa essas pessoas com um rótulo em comum
                            </label>
                            {asTeam && (
                                <Field>
                                    <Label htmlFor="des-team">Nome da equipe (opcional)</Label>
                                    <Input id="des-team" placeholder="ex: Dupla 1 — deixe em branco pra gerar automático" {...register('teamName')} />
                                </Field>
                            )}
                        </>
                    )}

                    <FormActions>
                        <span style={{ marginRight: 'auto', fontSize: '0.75rem', color: '#6c757d', alignSelf: 'center' }}>
                            {selectedStaffIds.length} pessoa(s) × {selectedShiftIds.length} turno(s) = {selectedStaffIds.length * selectedShiftIds.length} designação(ões)
                        </span>
                        <Button type="button" $variant="secondary" onClick={() => setCreateOpen(false)}>Cancelar</Button>
                        <Button type="submit" disabled={selectedStaffIds.length === 0 || selectedShiftIds.length === 0 || createMutation.isPending}>
                            {createMutation.isPending ? 'Salvando...' : 'Escalar'}
                        </Button>
                    </FormActions>
                </Form>
            </Modal>

            {/* Editar */}
            <Modal open={!!editing} onOpenChange={(open) => !open && setEditing(null)} title="Editar designação" width="560px">
                <Form onSubmit={editForm.handleSubmit((data) => updateMutation.mutate(data))}>
                    <Field>
                        <Label htmlFor="edit-staff">Brigadista</Label>
                        <Select id="edit-staff" {...editForm.register('staffMemberId', { required: true })}>
                            {editing && !activeStaff.some((s) => s.id === editing.staffMember.id) && <option value={editing.staffMember.id}>{editing.staffMember.user.name}</option>}
                            {activeStaff.map((s) => <option key={s.id} value={s.id}>{s.user.name}</option>)}
                        </Select>
                    </Field>
                    <Field>
                        <Label htmlFor="edit-role">Função no evento</Label>
                        <Input id="edit-role" {...editForm.register('role', { required: true })} />
                    </Field>
                    <Field>
                        <Label htmlFor="edit-shift">Turno</Label>
                        <Select id="edit-shift" {...editForm.register('shiftId', { required: true })}>
                            {!editing?.shiftId && <option value="">Selecione o turno…</option>}
                            {schedule.days.map((day) => (
                                <optgroup key={day.key} label={day.label}>
                                    {day.shifts.map(({ shift, title }) => <option key={shift.id} value={shift.id}>{title}</option>)}
                                </optgroup>
                            ))}
                        </Select>
                    </Field>
                    <Field>
                        <Label htmlFor="edit-post">Posto de atuação (opcional)</Label>
                        <Select id="edit-post" {...editForm.register('postId')}>
                            <option value="">Sem posto definido</option>
                            {posts.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </Select>
                    </Field>
                    <FormActions>
                        <Button type="button" $variant="secondary" onClick={() => setEditing(null)}>Cancelar</Button>
                        <Button type="submit" disabled={updateMutation.isPending}>{updateMutation.isPending ? 'Salvando...' : 'Salvar'}</Button>
                    </FormActions>
                </Form>
            </Modal>

            {canManage && event && (
                <ShiftsManager eventId={eventId} eventStart={event.startDate} eventEnd={event.endDate} shifts={shifts} open={shiftsOpen} onOpenChange={setShiftsOpen} />
            )}

            {event && <ExportModal event={event} designations={designations} open={exportOpen} initialMode={exportMode} onOpenChange={setExportOpen} onPrintList={setPrintIds} />}

            {printSchedule && event && (
                <PrintPortal active orientation="portrait" onFinished={() => setPrintIds(null)}>
                    <PrintDoc>
                        {printSchedule.days.map((day) => (
                            <div key={day.key} className="day">
                                <h1>Escala — {event.title}</h1>
                                <p className="sub">{[event.location, day.label].filter(Boolean).join(' · ')}</p>
                                <h2>{day.label}</h2>
                                {day.shifts.map((block) => (
                                    <div key={block.shift.id}>
                                        <h3>{block.title} ({block.total} pessoa{block.total === 1 ? '' : 's'})</h3>
                                        <table>
                                            <tbody>
                                                {block.slots.filter((slot) => slot.post || slot.people.length > 0).map((slot) => (
                                                    <tr key={slot.post?.id ?? 'none'}>
                                                        <th>{slot.post?.name ?? 'Sem posto'}{slot.capacity != null ? ` (${slot.people.length}/${slot.capacity})` : ''}</th>
                                                        <td>
                                                            {slot.people.length === 0 ? <em>— sem ninguém —</em> : slot.people.map((p, i) => (
                                                                <span key={p.designationId} className={p.status === 'PENDING' ? 'pending' : undefined}>
                                                                    {i > 0 ? '; ' : ''}{p.name}{p.role ? ` (${p.role})` : ''}{p.teamName ? ` — ${p.teamName}` : ''}{p.status === 'PENDING' ? ' *' : ''}
                                                                </span>
                                                            ))}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ))}
                                <p className="stamp">* aguardando confirmação · quem recusou não consta · gerada em {new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</p>
                            </div>
                        ))}
                    </PrintDoc>
                </PrintPortal>
            )}
        </>
    );
}
