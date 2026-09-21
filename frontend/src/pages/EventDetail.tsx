// frontend/src/pages/EventDetail.tsx
//
// Detalhe de um evento polimórfico. O conjunto de abas muda conforme
// `event.kind` (decisão 2 do docs/decisoes.md): assembleia/congresso/atuação
// de brigada mostram Escala + Ocorrências; reunião mostra Pauta/Ata + Presença.
// Arquivos é comum aos dois.

import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import * as Tabs from '@radix-ui/react-tabs';
import * as Popover from '@radix-ui/react-popover';
import styled from 'styled-components';
import { ArrowLeft, Plus, CalendarClock, Video, ExternalLink, Pencil, Trash2, MapPin, Upload, X, Eye, Paperclip } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageLayout } from '@/components/layout/PageLayout';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Field, Label, Input, Select, Textarea, Form, FormActions, FieldRow, HelpText } from '@/components/ui/FormField';
import { Table, TableWrapper, Thead, Tr, Th, Td, EmptyState, Badge } from '@/components/ui/Table';
import { AudioRecorder } from '@/components/media/AudioRecorder';
import {
    eventsApi,
    designationsApi,
    occurrenceReportsApi,
    meetingsApi,
    eventFilesApi,
    occurrenceReportFilesApi,
    eventPostsApi,
    type DesignationStatus,
    type AppEvent,
    type Designation,
    type EventPost,
    type OccurrenceReport,
    type OccurrenceReportFile,
    type EventFile,
} from '@/services/events';
import { mediaApi } from '@/services/media';
import { staffApi } from '@/services/staff';
import { peopleApi } from '@/services/people';
import { toast } from '@/utils/toast';
import { useAuth } from '@/contexts/AuthContext';
import { hasPermission } from '@/utils/permissions';
import { formatAppDate, toDateTimeLocalValue } from '@/utils/datetime';
import { KIND_LABEL, STATUS_LABEL, STATUS_TONE, EVENT_STATUS_VALUES } from '@/utils/eventLabels';
import type { AttendanceStatus, EventStatus } from '@/types';

const TabsList = styled(Tabs.List)`
    display: flex;
    gap: 0.5rem;
    border-bottom: 1px solid ${({ theme }) => theme.colors.borderLight};
    margin-bottom: 1rem;
`;

const TabsTrigger = styled(Tabs.Trigger)`
    padding: 0.6rem 0.25rem;
    background: transparent;
    border: none;
    border-bottom: 2px solid transparent;
    font-size: 0.875rem;
    font-weight: 600;
    color: ${({ theme }) => theme.colors.textMuted};
    cursor: pointer;

    &[data-state='active'] {
        color: ${({ theme }) => theme.colors.primary};
        border-bottom-color: ${({ theme }) => theme.colors.primary};
    }
`;

const BackLink = styled.button`
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    background: none;
    border: none;
    color: ${({ theme }) => theme.colors.textMuted};
    font-size: 0.8125rem;
    cursor: pointer;
    padding: 0;
    margin-bottom: 0.5rem;

    &:hover { color: ${({ theme }) => theme.colors.textDark}; }
`;

const InfoRow = styled.div`
    display: flex;
    gap: 1.5rem;
    flex-wrap: wrap;
    font-size: 0.8125rem;
    color: ${({ theme }) => theme.colors.textMedium};
    margin-bottom: 1rem;

    strong { color: ${({ theme }) => theme.colors.textDark}; }
`;

const ToolbarRow = styled.div`
    display: flex;
    justify-content: flex-end;
    margin-bottom: 0.75rem;
`;

const DESIGNATION_STATUS_LABEL: Record<DesignationStatus, string> = {
    PENDING: 'Pendente',
    CONFIRMED: 'Confirmada',
    DECLINED: 'Recusada',
};

const OCCURRENCE_TYPES = [
    { value: 'MEDICAL', label: 'Médica' },
    { value: 'SAFETY', label: 'Segurança' },
    { value: 'BEHAVIORAL', label: 'Comportamental' },
    { value: 'GENERAL', label: 'Geral' },
];

const ATTENDANCE_LABEL: Record<AttendanceStatus, string> = {
    PRESENT: 'Presente',
    ABSENT: 'Ausente',
    JUSTIFIED_ABSENT: 'Falta justificada',
};

export default function EventDetail() {
    const { id } = useParams<{ id: string }>();
    const eventId = id!;
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const canManageEvent = hasPermission(user, 'events:manage');
    const [editOpen, setEditOpen] = useState(false);

    const { data: event } = useQuery({ queryKey: ['events', eventId], queryFn: () => eventsApi.get(eventId) });

    const statusMutation = useMutation({
        mutationFn: (status: EventStatus) => eventsApi.update(eventId, { status }),
        onSuccess: () => {
            toast.success('Status atualizado.');
            queryClient.invalidateQueries({ queryKey: ['events', eventId] });
            queryClient.invalidateQueries({ queryKey: ['events'] });
        },
        onError: (error: any) => toast.error(error?.response?.data?.message || 'Não foi possível atualizar o status.'),
    });

    const removeMutation = useMutation({
        mutationFn: () => eventsApi.remove(eventId),
        onSuccess: () => {
            toast.success('Evento excluído.');
            queryClient.invalidateQueries({ queryKey: ['events'] });
            navigate('/events');
        },
        onError: (error: any) => toast.error(error?.response?.data?.message || 'Não foi possível excluir o evento.'),
    });

    if (!event) {
        return (
            <PageLayout title="Evento" icon={<CalendarClock size={16} />}>
                <EmptyState>Carregando...</EmptyState>
            </PageLayout>
        );
    }

    const isOperation = event.kind !== 'REUNIAO';

    const handleDelete = () => {
        const confirmed = window.confirm(
            `Excluir o evento "${event.title}"? Escala, ocorrências e arquivos associados deixarão de aparecer no sistema. Essa ação não pode ser desfeita.`,
        );
        if (confirmed) removeMutation.mutate();
    };

    return (
        <PageLayout
            title={event.title}
            subtitle={formatAppDate(event.startDate, 'dd/MM/yyyy HH:mm')}
            icon={<CalendarClock size={16} />}
            actions={
                canManageEvent ? (
                    <>
                        <Button $variant="secondary" onClick={() => setEditOpen(true)}>
                            <Pencil size={16} /> Editar evento
                        </Button>
                        <Button $variant="danger" onClick={handleDelete} disabled={removeMutation.isPending}>
                            <Trash2 size={16} /> Excluir
                        </Button>
                    </>
                ) : undefined
            }
        >
            <BackLink onClick={() => navigate('/events')}>
                <ArrowLeft size={14} /> Voltar para eventos
            </BackLink>

            <InfoRow>
                {event.location && <span><strong>Local:</strong> {event.location}</span>}
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                    <strong>Status:</strong>
                    <Badge $tone={STATUS_TONE[event.status]}>{STATUS_LABEL[event.status]}</Badge>
                    {canManageEvent && (
                        <Select
                            value={event.status}
                            onChange={(e) => statusMutation.mutate(e.target.value as EventStatus)}
                            disabled={statusMutation.isPending}
                            style={{ fontSize: '0.75rem', padding: '0.15rem 0.4rem' }}
                        >
                            {EVENT_STATUS_VALUES.map((status) => (
                                <option key={status} value={status}>{STATUS_LABEL[status]}</option>
                            ))}
                        </Select>
                    )}
                </span>
                {isOperation && event.operation?.estimatedAudienceCount != null && (
                    <span><strong>Público estimado:</strong> {event.operation.estimatedAudienceCount}</span>
                )}
            </InfoRow>

            {canManageEvent && <EditEventModal event={event} open={editOpen} onOpenChange={setEditOpen} />}

            <Tabs.Root defaultValue={isOperation ? 'designations' : 'meeting'}>
                <TabsList>
                    {isOperation ? (
                        <>
                            <TabsTrigger value="designations">Escala</TabsTrigger>
                            <TabsTrigger value="occurrences">Ocorrências</TabsTrigger>
                            <TabsTrigger value="map">Mapa</TabsTrigger>
                        </>
                    ) : (
                        <>
                            <TabsTrigger value="meeting">Reunião</TabsTrigger>
                            <TabsTrigger value="attendance">Presença</TabsTrigger>
                        </>
                    )}
                    <TabsTrigger value="files">Arquivos</TabsTrigger>
                </TabsList>

                {isOperation && (
                    <>
                        <Tabs.Content value="designations"><DesignationsTab eventId={eventId} /></Tabs.Content>
                        <Tabs.Content value="occurrences"><OccurrencesTab eventId={eventId} /></Tabs.Content>
                        <Tabs.Content value="map"><FloorPlanTab eventId={eventId} /></Tabs.Content>
                    </>
                )}
                {!isOperation && (
                    <>
                        <Tabs.Content value="meeting"><MeetingTab eventId={eventId} meeting={event.meeting} /></Tabs.Content>
                        <Tabs.Content value="attendance"><AttendanceTab eventId={eventId} /></Tabs.Content>
                    </>
                )}
                <Tabs.Content value="files"><FilesTab eventId={eventId} /></Tabs.Content>
            </Tabs.Root>
        </PageLayout>
    );
}

interface EditEventFormData {
    title: string;
    location: string;
    startDate: string;
    endDate: string;
    estimatedAudienceCount: string;
    notes: string;
}

/** Modal de edição do tronco do evento. `kind` é imutável (decisão 2 do docs/decisoes.md) — a pauta de reunião tem endpoint próprio (aba Reunião). O status é editado à parte, pelo seletor rápido no cabeçalho. */
function EditEventModal({ event, open, onOpenChange }: { event: AppEvent; open: boolean; onOpenChange: (open: boolean) => void }) {
    const queryClient = useQueryClient();
    const isOperation = event.kind !== 'REUNIAO';
    const { register, handleSubmit, reset } = useForm<EditEventFormData>();

    useEffect(() => {
        if (open) {
            reset({
                title: event.title,
                location: event.location ?? '',
                startDate: toDateTimeLocalValue(event.startDate),
                endDate: toDateTimeLocalValue(event.endDate),
                estimatedAudienceCount: event.operation?.estimatedAudienceCount != null ? String(event.operation.estimatedAudienceCount) : '',
                notes: event.operation?.notes ?? '',
            });
        }
    }, [open, event, reset]);

    const updateMutation = useMutation({
        mutationFn: (input: Parameters<typeof eventsApi.update>[1]) => eventsApi.update(event.id, input),
        onSuccess: () => {
            toast.success('Evento atualizado.');
            queryClient.invalidateQueries({ queryKey: ['events', event.id] });
            queryClient.invalidateQueries({ queryKey: ['events'] });
            onOpenChange(false);
        },
        onError: (error: any) => toast.error(error?.response?.data?.message || 'Não foi possível salvar o evento.'),
    });

    const onSubmit = (data: EditEventFormData) => {
        updateMutation.mutate({
            title: data.title,
            location: data.location || undefined,
            startDate: data.startDate,
            endDate: data.endDate || undefined,
            ...(isOperation ? {
                estimatedAudienceCount: data.estimatedAudienceCount ? Number(data.estimatedAudienceCount) : undefined,
                notes: data.notes || undefined,
            } : {}),
        });
    };

    return (
        <Modal open={open} onOpenChange={onOpenChange} title={`Editar: ${KIND_LABEL[event.kind]}`} width="560px">
            <Form onSubmit={handleSubmit(onSubmit)}>
                <Field>
                    <Label htmlFor="edit-title">Título</Label>
                    <Input id="edit-title" {...register('title', { required: true })} />
                </Field>
                <FieldRow>
                    <Field>
                        <Label htmlFor="edit-startDate">Data/hora de início</Label>
                        <Input id="edit-startDate" type="datetime-local" {...register('startDate', { required: true })} />
                    </Field>
                    <Field>
                        <Label htmlFor="edit-endDate">Data/hora de término (opcional)</Label>
                        <Input id="edit-endDate" type="datetime-local" {...register('endDate')} />
                    </Field>
                </FieldRow>
                <Field>
                    <Label htmlFor="edit-location">Local</Label>
                    <Input id="edit-location" {...register('location')} />
                </Field>
                {isOperation && (
                    <>
                        <Field>
                            <Label htmlFor="edit-estimatedAudienceCount">Estimativa de público (opcional)</Label>
                            <Input id="edit-estimatedAudienceCount" type="number" min={0} {...register('estimatedAudienceCount')} />
                        </Field>
                        <Field>
                            <Label htmlFor="edit-notes">Observações</Label>
                            <Textarea id="edit-notes" {...register('notes')} />
                        </Field>
                    </>
                )}
                <FormActions>
                    <Button type="button" $variant="secondary" onClick={() => onOpenChange(false)}>Cancelar</Button>
                    <Button type="submit" disabled={updateMutation.isPending}>{updateMutation.isPending ? 'Salvando...' : 'Salvar'}</Button>
                </FormActions>
            </Form>
        </Modal>
    );
}

const CheckList = styled.div`
    max-height: 220px;
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

interface DesignationFormData {
    role: string;
    shiftStart: string;
    shiftEnd: string;
    postId: string;
    teamName: string;
}

interface EditDesignationFormData {
    staffMemberId: string;
    role: string;
    shiftStart: string;
    shiftEnd: string;
    postId: string;
}

function DesignationsTab({ eventId }: { eventId: string }) {
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([]);
    const [asTeam, setAsTeam] = useState(false);
    const [editingDesignation, setEditingDesignation] = useState<Designation | null>(null);
    const queryClient = useQueryClient();
    const { user } = useAuth();
    // Criar designação exige `events:manage` no backend — buscar a lista completa de
    // staff sem essa permissão só gera um 403 (e o toast do interceptor global) para
    // quem só está vendo o evento (visualização é aberta a todos, ver Router.tsx).
    const canManageDesignations = hasPermission(user, 'events:manage');

    const { data: designations } = useQuery({ queryKey: ['events', eventId, 'designations'], queryFn: () => designationsApi.list(eventId) });
    const { data: staff } = useQuery({ queryKey: ['staff'], queryFn: () => staffApi.list(), enabled: canManageDesignations });
    const { data: event } = useQuery({ queryKey: ['events', eventId], queryFn: () => eventsApi.get(eventId) });
    const posts = event?.operation?.posts ?? [];
    const activeStaff = (staff ?? []).filter((s) => s.status === 'ACTIVE');

    const { register, handleSubmit, reset } = useForm<DesignationFormData>();
    const editForm = useForm<EditDesignationFormData>();

    const createMutation = useMutation({
        mutationFn: (input: DesignationFormData) =>
            designationsApi.createBulk(eventId, {
                staffMemberIds: selectedStaffIds,
                role: input.role,
                shiftStart: input.shiftStart,
                shiftEnd: input.shiftEnd,
                postId: input.postId || undefined,
                asTeam: asTeam && selectedStaffIds.length >= 2,
                teamName: input.teamName || undefined,
            }),
        onSuccess: (created) => {
            toast.success(created.length > 1 ? `${created.length} designações criadas.` : 'Designação criada.');
            queryClient.invalidateQueries({ queryKey: ['events', eventId, 'designations'] });
            setModalOpen(false);
        },
        onError: (error: any) => toast.error(error?.response?.data?.message || 'Não foi possível criar a designação.'),
    });

    const statusMutation = useMutation({
        mutationFn: ({ designationId, status }: { designationId: string; status: DesignationStatus }) =>
            designationsApi.updateStatus(eventId, designationId, status),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['events', eventId, 'designations'] }),
        onError: (error: any) => toast.error(error?.response?.data?.message || 'Não foi possível atualizar.'),
    });

    const openModal = () => {
        reset({ role: '', shiftStart: '', shiftEnd: '', postId: '', teamName: '' });
        setSelectedStaffIds([]);
        setAsTeam(false);
        setModalOpen(true);
    };

    const toggleStaff = (id: string) => {
        setSelectedStaffIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    };

    const removeMutation = useMutation({
        mutationFn: (designationId: string) => designationsApi.remove(eventId, designationId),
        onSuccess: () => {
            toast.success('Designação removida.');
            queryClient.invalidateQueries({ queryKey: ['events', eventId, 'designations'] });
        },
        onError: (error: any) => toast.error(error?.response?.data?.message || 'Não foi possível remover a designação.'),
    });

    const updateMutation = useMutation({
        mutationFn: (input: EditDesignationFormData) =>
            designationsApi.update(eventId, editingDesignation!.id, {
                staffMemberId: input.staffMemberId,
                role: input.role,
                shiftStart: input.shiftStart,
                shiftEnd: input.shiftEnd,
                postId: input.postId || undefined,
            }),
        onSuccess: () => {
            toast.success('Designação atualizada.');
            queryClient.invalidateQueries({ queryKey: ['events', eventId, 'designations'] });
            setEditingDesignation(null);
        },
        onError: (error: any) => toast.error(error?.response?.data?.message || 'Não foi possível atualizar a designação.'),
    });

    const openEditModal = (d: Designation) => {
        editForm.reset({
            staffMemberId: d.staffMember.id,
            role: d.role,
            shiftStart: toDateTimeLocalValue(d.shiftStart),
            shiftEnd: toDateTimeLocalValue(d.shiftEnd),
            postId: d.post?.id ?? '',
        });
        setEditingDesignation(d);
    };

    return (
        <>
            {canManageDesignations && (
                <ToolbarRow>
                    <Button onClick={openModal}>
                        <Plus size={16} /> Nova designação
                    </Button>
                </ToolbarRow>
            )}
            <TableWrapper>
                <Table>
                    <Thead>
                        <tr>
                            <Th>Brigadista</Th>
                            <Th>Função</Th>
                            <Th>Turno</Th>
                            <Th>Posto</Th>
                            <Th>Equipe</Th>
                            <Th>Status</Th>
                            <Th>Alterar</Th>
                            {canManageDesignations && <Th></Th>}
                        </tr>
                    </Thead>
                    <tbody>
                        {(designations ?? []).map((d) => (
                            <Tr key={d.id}>
                                <Td>{d.staffMember.user.name}</Td>
                                <Td>{d.role}</Td>
                                <Td>{formatAppDate(d.shiftStart, 'dd/MM HH:mm')} — {formatAppDate(d.shiftEnd, 'HH:mm')}</Td>
                                <Td>{d.post?.name ?? '—'}</Td>
                                <Td>{d.team ? <Badge $tone="info">{d.team.name}</Badge> : '—'}</Td>
                                <Td><Badge $tone={d.status === 'CONFIRMED' ? 'success' : d.status === 'DECLINED' ? 'danger' : 'warning'}>{DESIGNATION_STATUS_LABEL[d.status]}</Badge></Td>
                                <Td>
                                    {/* DesignationsService.updateStatus (Fase 2, docs/decisoes.md) só deixa quem
                                        tem events:manage OU é o próprio staff alterar — esconder o controle pros
                                        demais evita um 403 ao tentar mexer na designação de outra pessoa. */}
                                    {(canManageDesignations || d.staffMember.user.id === user?.id) ? (
                                        <Select value={d.status} onChange={(e) => statusMutation.mutate({ designationId: d.id, status: e.target.value as DesignationStatus })}>
                                            <option value="PENDING">Pendente</option>
                                            <option value="CONFIRMED">Confirmada</option>
                                            <option value="DECLINED">Recusada</option>
                                        </Select>
                                    ) : '—'}
                                </Td>
                                {canManageDesignations && (
                                    <Td>
                                        <Button $variant="ghost" onClick={() => openEditModal(d)}>
                                            <Pencil size={14} />
                                        </Button>
                                        <Button
                                            $variant="ghost"
                                            onClick={() => {
                                                if (window.confirm(`Remover a designação de ${d.staffMember.user.name}?`)) {
                                                    removeMutation.mutate(d.id);
                                                }
                                            }}
                                        >
                                            <Trash2 size={14} />
                                        </Button>
                                    </Td>
                                )}
                            </Tr>
                        ))}
                    </tbody>
                </Table>
                {(designations ?? []).length === 0 && <EmptyState>Nenhuma designação criada ainda.</EmptyState>}
            </TableWrapper>

            <Modal open={modalOpen} onOpenChange={setModalOpen} title="Nova designação" width="620px">
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
                                    <input type="checkbox" checked={selectedStaffIds.includes(s.id)} onChange={() => toggleStaff(s.id)} />
                                    {s.user.name}
                                </label>
                            ))}
                            {activeStaff.length === 0 && <span>Nenhum brigadista ativo cadastrado.</span>}
                        </CheckList>
                    </Field>

                    <Field>
                        <Label htmlFor="role">Função no evento</Label>
                        <Input id="role" placeholder="ex: Brigadista, Bombeiro Civil, Coordenador" {...register('role', { required: true })} />
                    </Field>

                    <FieldRow>
                        <Field>
                            <Label htmlFor="shiftStart">Início do turno</Label>
                            <Input id="shiftStart" type="datetime-local" {...register('shiftStart', { required: true })} />
                        </Field>
                        <Field>
                            <Label htmlFor="shiftEnd">Fim do turno</Label>
                            <Input id="shiftEnd" type="datetime-local" {...register('shiftEnd', { required: true })} />
                        </Field>
                    </FieldRow>

                    <Field>
                        <Label htmlFor="postId">Posto de atuação (opcional)</Label>
                        <Select id="postId" {...register('postId')}>
                            <option value="">Sem posto definido</option>
                            {posts.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </Select>
                    </Field>

                    {selectedStaffIds.length >= 2 && (
                        <>
                            <Field>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8125rem' }}>
                                    <input type="checkbox" checked={asTeam} onChange={(e) => setAsTeam(e.target.checked)} />
                                    Tratar como equipe (dupla/trio) — agrupa essas pessoas com um rótulo em comum
                                </label>
                            </Field>
                            {asTeam && (
                                <Field>
                                    <Label htmlFor="teamName">Nome da equipe (opcional)</Label>
                                    <Input id="teamName" placeholder="ex: Dupla 1 — deixe em branco pra gerar automático" {...register('teamName')} />
                                </Field>
                            )}
                        </>
                    )}

                    <FormActions>
                        <Button type="button" $variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
                        <Button type="submit" disabled={selectedStaffIds.length === 0 || createMutation.isPending}>
                            {createMutation.isPending ? 'Salvando...' : selectedStaffIds.length > 1 ? `Escalar ${selectedStaffIds.length} pessoas` : 'Designar'}
                        </Button>
                    </FormActions>
                </Form>
            </Modal>

            <Modal open={!!editingDesignation} onOpenChange={(open) => !open && setEditingDesignation(null)} title="Editar designação" width="560px">
                <Form onSubmit={editForm.handleSubmit((data) => updateMutation.mutate(data))}>
                    <Field>
                        <Label htmlFor="edit-staffMemberId">Brigadista</Label>
                        <Select id="edit-staffMemberId" {...editForm.register('staffMemberId', { required: true })}>
                            {editingDesignation && !activeStaff.some((s) => s.id === editingDesignation.staffMember.id) && (
                                <option value={editingDesignation.staffMember.id}>{editingDesignation.staffMember.user.name}</option>
                            )}
                            {activeStaff.map((s) => <option key={s.id} value={s.id}>{s.user.name}</option>)}
                        </Select>
                    </Field>

                    <Field>
                        <Label htmlFor="edit-role">Função no evento</Label>
                        <Input id="edit-role" placeholder="ex: Brigadista, Bombeiro Civil, Coordenador" {...editForm.register('role', { required: true })} />
                    </Field>

                    <FieldRow>
                        <Field>
                            <Label htmlFor="edit-shiftStart">Início do turno</Label>
                            <Input id="edit-shiftStart" type="datetime-local" {...editForm.register('shiftStart', { required: true })} />
                        </Field>
                        <Field>
                            <Label htmlFor="edit-shiftEnd">Fim do turno</Label>
                            <Input id="edit-shiftEnd" type="datetime-local" {...editForm.register('shiftEnd', { required: true })} />
                        </Field>
                    </FieldRow>

                    <Field>
                        <Label htmlFor="edit-postId">Posto de atuação (opcional)</Label>
                        <Select id="edit-postId" {...editForm.register('postId')}>
                            <option value="">Sem posto definido</option>
                            {posts.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </Select>
                    </Field>

                    <FormActions>
                        <Button type="button" $variant="secondary" onClick={() => setEditingDesignation(null)}>Cancelar</Button>
                        <Button type="submit" disabled={updateMutation.isPending}>
                            {updateMutation.isPending ? 'Salvando...' : 'Salvar'}
                        </Button>
                    </FormActions>
                </Form>
            </Modal>
        </>
    );
}

function OccurrenceAudioPlayer({ url }: { url: string }) {
    const [open, setOpen] = useState(false);
    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0, font: 'inherit' }}
            >
                <Eye size={12} /> Ouvir áudio
            </button>
            <Modal open={open} onOpenChange={setOpen} title="Áudio da ocorrência">
                <audio src={url} controls style={{ width: '100%' }} />
            </Modal>
        </>
    );
}

const OCCURRENCE_FILE_ALLOWED_TYPES = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/svg+xml',
];
const OCCURRENCE_FILE_MAX_SIZE = 25 * 1024 * 1024; // 25MB — mesmo padrão de media.service.ts

function OccurrencesTab({ eventId }: { eventId: string }) {
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<OccurrenceReport | null>(null);
    const [audioFile, setAudioFile] = useState<File | null>(null);
    const [isUploadingAudio, setIsUploadingAudio] = useState(false);
    const [attachmentsFor, setAttachmentsFor] = useState<OccurrenceReport | null>(null);
    const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
    const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
    const queryClient = useQueryClient();
    const { user } = useAuth();
    // Registrar é aberto a todo mundo (quem está em campo percebe o incidente), mas
    // remover um relatório já registrado exige events:manage no backend.
    const canRemove = hasPermission(user, 'events:manage');
    const canEditReport = (r: OccurrenceReport) => r.createdByUserId === user?.id || canRemove;
    const { data: reports } = useQuery({ queryKey: ['events', eventId, 'occurrence-reports'], queryFn: () => occurrenceReportsApi.list(eventId) });
    const { register, handleSubmit, reset } = useForm<{ type: string; title: string; description: string }>();

    const saveMutation = useMutation({
        mutationFn: async (input: { type: string; title: string; description?: string }) => {
            let audioUrl = editing?.audioUrl ?? undefined;
            if (audioFile) {
                setIsUploadingAudio(true);
                try {
                    const { fileUrl } = await mediaApi.upload(audioFile, 'occurrence-audio');
                    audioUrl = fileUrl;
                } finally {
                    setIsUploadingAudio(false);
                }
            }
            return editing
                ? occurrenceReportsApi.update(eventId, editing.id, { ...input, audioUrl })
                : occurrenceReportsApi.create(eventId, { ...input, audioUrl });
        },
        onSuccess: () => {
            toast.success(editing ? 'Relatório atualizado.' : 'Relatório registrado.');
            queryClient.invalidateQueries({ queryKey: ['events', eventId, 'occurrence-reports'] });
            setModalOpen(false);
            setAudioFile(null);
            setEditing(null);
        },
        onError: (error: any) =>
            toast.error(error?.response?.data?.message || (editing ? 'Não foi possível atualizar o relatório.' : 'Não foi possível registrar o relatório.')),
    });

    const removeMutation = useMutation({
        mutationFn: (reportId: string) => occurrenceReportsApi.remove(eventId, reportId),
        onSuccess: () => {
            toast.success('Relatório removido.');
            queryClient.invalidateQueries({ queryKey: ['events', eventId, 'occurrence-reports'] });
        },
        onError: (error: any) => toast.error(error?.response?.data?.message || 'Não foi possível remover o relatório.'),
    });

    const { data: attachments } = useQuery({
        queryKey: ['events', eventId, 'occurrence-reports', attachmentsFor?.id, 'files'],
        queryFn: () => occurrenceReportFilesApi.list(eventId, attachmentsFor!.id),
        enabled: !!attachmentsFor,
    });

    const addAttachmentMutation = useMutation({
        mutationFn: async () => {
            if (!attachmentFile || !attachmentsFor) throw new Error('Selecione um arquivo.');
            if (!OCCURRENCE_FILE_ALLOWED_TYPES.includes(attachmentFile.type)) {
                throw new Error('Tipo de arquivo não permitido. Envie PDF, DOC, DOCX ou uma imagem.');
            }
            if (attachmentFile.size > OCCURRENCE_FILE_MAX_SIZE) {
                throw new Error('O arquivo deve ter no máximo 25MB.');
            }
            setIsUploadingAttachment(true);
            try {
                const { fileUrl, storageKey } = await mediaApi.upload(attachmentFile, 'occurrence-files');
                return occurrenceReportFilesApi.create(eventId, attachmentsFor.id, {
                    name: attachmentFile.name,
                    storageKey,
                    externalUrl: fileUrl,
                    mimeType: attachmentFile.type,
                });
            } finally {
                setIsUploadingAttachment(false);
            }
        },
        onSuccess: () => {
            toast.success('Arquivo anexado.');
            queryClient.invalidateQueries({ queryKey: ['events', eventId, 'occurrence-reports', attachmentsFor?.id, 'files'] });
            setAttachmentFile(null);
        },
        onError: (error: any) => toast.error(error?.response?.data?.message || error?.message || 'Não foi possível anexar o arquivo.'),
    });

    const removeAttachmentMutation = useMutation({
        mutationFn: (fileId: string) => occurrenceReportFilesApi.remove(eventId, attachmentsFor!.id, fileId),
        onSuccess: () => {
            toast.success('Anexo removido.');
            queryClient.invalidateQueries({ queryKey: ['events', eventId, 'occurrence-reports', attachmentsFor?.id, 'files'] });
        },
        onError: (error: any) => toast.error(error?.response?.data?.message || 'Não foi possível remover o anexo.'),
    });

    const canEditAttachments = attachmentsFor ? canEditReport(attachmentsFor) : false;

    return (
        <>
            <ToolbarRow>
                <Button
                    onClick={() => {
                        reset({ type: 'GENERAL', title: '', description: '' });
                        setAudioFile(null);
                        setEditing(null);
                        setModalOpen(true);
                    }}
                >
                    <Plus size={16} /> Novo relatório
                </Button>
            </ToolbarRow>
            <TableWrapper>
                <Table>
                    <Thead>
                        <tr><Th>Tipo</Th><Th>Título</Th><Th>Descrição</Th><Th>Áudio</Th><Th>Registrado por</Th><Th>Data</Th><Th></Th></tr>
                    </Thead>
                    <tbody>
                        {(reports ?? []).map((r) => (
                            <Tr key={r.id}>
                                <Td><Badge>{OCCURRENCE_TYPES.find((t) => t.value === r.type)?.label ?? r.type}</Badge></Td>
                                <Td>{r.title}</Td>
                                <Td>{r.description || '—'}</Td>
                                <Td>{r.audioUrl ? <OccurrenceAudioPlayer url={r.audioUrl} /> : '—'}</Td>
                                <Td>{r.createdBy.name}</Td>
                                <Td>{formatAppDate(r.createdAt, 'dd/MM/yyyy HH:mm')}</Td>
                                <Td style={{ display: 'flex', gap: 4 }}>
                                    <Button $variant="ghost" onClick={() => setAttachmentsFor(r)}>
                                        <Paperclip size={14} />
                                    </Button>
                                    {canEditReport(r) && (
                                        <Button
                                            $variant="ghost"
                                            onClick={() => {
                                                reset({ type: r.type, title: r.title, description: r.description ?? '' });
                                                setAudioFile(null);
                                                setEditing(r);
                                                setModalOpen(true);
                                            }}
                                        >
                                            <Pencil size={14} />
                                        </Button>
                                    )}
                                    {canRemove && (
                                        <Button
                                            $variant="ghost"
                                            onClick={() => {
                                                if (window.confirm(`Remover o relatório "${r.title}"?`)) {
                                                    removeMutation.mutate(r.id);
                                                }
                                            }}
                                        >
                                            <Trash2 size={14} />
                                        </Button>
                                    )}
                                </Td>
                            </Tr>
                        ))}
                    </tbody>
                </Table>
                {(reports ?? []).length === 0 && <EmptyState>Nenhum relatório de ocorrência registrado.</EmptyState>}
            </TableWrapper>

            <Modal
                open={modalOpen}
                onOpenChange={setModalOpen}
                title={editing ? 'Editar relatório de ocorrência' : 'Novo relatório de ocorrência'}
            >
                <Form onSubmit={handleSubmit((data) => saveMutation.mutate(data))}>
                    <Field>
                        <Label htmlFor="type">Tipo</Label>
                        <Select id="type" {...register('type', { required: true })}>
                            {OCCURRENCE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </Select>
                    </Field>
                    <Field>
                        <Label htmlFor="title">Título</Label>
                        <Input id="title" {...register('title', { required: true })} />
                    </Field>
                    <Field>
                        <Label htmlFor="description">Descrição</Label>
                        <Textarea id="description" {...register('description')} />
                    </Field>
                    <Field>
                        <Label>Áudio (opcional)</Label>
                        {editing?.audioUrl && !audioFile && (
                            <div style={{ marginBottom: 8 }}>
                                <OccurrenceAudioPlayer url={editing.audioUrl} />
                                <HelpText>Grave um novo áudio abaixo para substituir o atual.</HelpText>
                            </div>
                        )}
                        <AudioRecorder onRecorded={setAudioFile} disabled={saveMutation.isPending} />
                    </Field>
                    <FormActions>
                        <Button type="button" $variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
                        <Button type="submit" disabled={saveMutation.isPending}>
                            {isUploadingAudio ? 'Enviando áudio...' : saveMutation.isPending ? 'Salvando...' : editing ? 'Salvar' : 'Registrar'}
                        </Button>
                    </FormActions>
                </Form>
            </Modal>

            <Modal
                open={!!attachmentsFor}
                onOpenChange={(open) => !open && setAttachmentsFor(null)}
                title={`Anexos — ${attachmentsFor?.title ?? ''}`}
            >
                <TableWrapper>
                    <Table>
                        <Thead><tr><Th>Nome</Th><Th>Link</Th>{canEditAttachments && <Th></Th>}</tr></Thead>
                        <tbody>
                            {(attachments ?? []).map((f: OccurrenceReportFile) => (
                                <Tr key={f.id}>
                                    <Td>{f.name}</Td>
                                    <Td>
                                        {f.externalUrl ? (
                                            <a href={f.externalUrl} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                                Abrir <ExternalLink size={12} />
                                            </a>
                                        ) : '—'}
                                    </Td>
                                    {canEditAttachments && (
                                        <Td>
                                            <Button
                                                $variant="ghost"
                                                onClick={() => {
                                                    if (window.confirm(`Remover o anexo "${f.name}"?`)) {
                                                        removeAttachmentMutation.mutate(f.id);
                                                    }
                                                }}
                                            >
                                                <Trash2 size={14} />
                                            </Button>
                                        </Td>
                                    )}
                                </Tr>
                            ))}
                        </tbody>
                    </Table>
                    {(attachments ?? []).length === 0 && <EmptyState>Nenhum arquivo anexado ainda.</EmptyState>}
                </TableWrapper>

                {canEditAttachments && (
                    <Form onSubmit={(e) => { e.preventDefault(); addAttachmentMutation.mutate(); }} style={{ marginTop: '1rem' }}>
                        <Field>
                            <Label htmlFor="attachment-file">Anexar novo arquivo</Label>
                            <input
                                id="attachment-file"
                                type="file"
                                accept={OCCURRENCE_FILE_ALLOWED_TYPES.join(',')}
                                onChange={(e) => setAttachmentFile(e.target.files?.[0] ?? null)}
                            />
                            <HelpText>PDF, DOC, DOCX ou imagem, até 25MB.</HelpText>
                        </Field>
                        <FormActions>
                            <Button type="submit" disabled={!attachmentFile || addAttachmentMutation.isPending}>
                                {isUploadingAttachment ? 'Enviando...' : addAttachmentMutation.isPending ? 'Salvando...' : 'Anexar'}
                            </Button>
                        </FormActions>
                    </Form>
                )}
            </Modal>
        </>
    );
}

const FloorPlanUploadBox = styled.label`
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 3rem 1rem;
    border: 2px dashed ${({ theme }) => theme.colors.borderLight};
    border-radius: ${({ theme }) => theme.radii.md};
    color: ${({ theme }) => theme.colors.textMuted};
    font-size: 0.8125rem;
    cursor: pointer;

    &:hover { border-color: ${({ theme }) => theme.colors.primary}; }

    input { display: none; }
`;

const FloorPlanCanvas = styled.div<{ $placing: boolean }>`
    position: relative;
    display: inline-block;
    max-width: 100%;
    border-radius: ${({ theme }) => theme.radii.md};
    overflow: hidden;
    border: 1px solid ${({ theme }) => theme.colors.borderLight};
    cursor: ${({ $placing }) => ($placing ? 'crosshair' : 'default')};

    img { display: block; max-width: 100%; user-select: none; -webkit-user-drag: none; }
`;

const Pin = styled.button<{ $tone: 'success' | 'warning' | 'info'; $dragging?: boolean }>`
    position: absolute;
    transform: translate(-50%, -50%);
    min-width: 28px;
    height: 28px;
    padding: 0 0.4rem;
    border-radius: ${({ theme }) => theme.radii.pill};
    border: 2px solid white;
    box-shadow: ${({ theme }) => theme.shadows.e2};
    color: white;
    font-size: 0.6875rem;
    font-weight: 700;
    cursor: ${({ $dragging }) => ($dragging ? 'grabbing' : 'grab')};
    touch-action: none;
    opacity: ${({ $dragging }) => ($dragging ? 0.85 : 1)};
    background: ${({ $tone, theme }) =>
        $tone === 'success' ? theme.colors.success : $tone === 'warning' ? theme.colors.warning : theme.colors.primary};
`;

const PendingPin = styled.div`
    position: absolute;
    transform: translate(-50%, -50%);
    width: 20px;
    height: 20px;
    border-radius: 50%;
    border: 2px dashed ${({ theme }) => theme.colors.textDark};
    background: rgba(255, 255, 255, 0.6);
`;

const PostPopoverContent = styled(Popover.Content)`
    width: 260px;
    background: ${({ theme }) => theme.colors.white};
    border-radius: ${({ theme }) => theme.radii.md};
    box-shadow: ${({ theme }) => theme.shadows.e3};
    border: 1px solid ${({ theme }) => theme.colors.borderLight};
    padding: 0.75rem;
    font-size: 0.8125rem;
    z-index: 100;
`;

const TeamGroup = styled.div`
    margin-top: 0.35rem;
    padding: 0.35rem 0.5rem;
    background: ${({ theme }) => theme.colors.lightGray};
    border-radius: ${({ theme }) => theme.radii.sm};

    strong { display: block; font-size: 0.75rem; margin-bottom: 0.15rem; }
    span { display: block; font-size: 0.75rem; color: ${({ theme }) => theme.colors.textMedium}; }
`;

function FloorPlanTab({ eventId }: { eventId: string }) {
    const queryClient = useQueryClient();
    const { data: event } = useQuery({ queryKey: ['events', eventId], queryFn: () => eventsApi.get(eventId) });
    const { data: designations } = useQuery({ queryKey: ['events', eventId, 'designations'], queryFn: () => designationsApi.list(eventId) });

    const [isPlacing, setIsPlacing] = useState(false);
    const [pendingPos, setPendingPos] = useState<{ x: number; y: number } | null>(null);
    const [shiftFilter, setShiftFilter] = useState('all');
    const [dragging, setDragging] = useState<{ postId: string; x: number; y: number } | null>(null);
    const canvasRef = useRef<HTMLDivElement>(null);
    const draggedRef = useRef(false);

    const { register, handleSubmit, reset } = useForm<{ name: string; capacity: string }>();

    const posts = event?.operation?.posts ?? [];
    const floorPlanUrl = event?.operation?.floorPlanUrl;

    const uploadFloorPlanMutation = useMutation({
        mutationFn: async (file: File) => {
            const { storageKey, fileUrl } = await mediaApi.upload(file, 'event-floor-plan');
            return eventPostsApi.setFloorPlan(eventId, { floorPlanKey: storageKey, floorPlanUrl: fileUrl });
        },
        onSuccess: () => {
            toast.success('Planta baixa atualizada.');
            queryClient.invalidateQueries({ queryKey: ['events', eventId] });
        },
        onError: (error: any) => toast.error(error?.response?.data?.message || 'Não foi possível enviar a planta baixa.'),
    });

    const createPostMutation = useMutation({
        mutationFn: (input: { name: string; capacity?: number; posX: number; posY: number }) => eventPostsApi.create(eventId, input),
        onSuccess: () => {
            toast.success('Posto adicionado.');
            queryClient.invalidateQueries({ queryKey: ['events', eventId] });
            setPendingPos(null);
            setIsPlacing(false);
        },
        onError: (error: any) => toast.error(error?.response?.data?.message || 'Não foi possível criar o posto.'),
    });

    const removePostMutation = useMutation({
        mutationFn: (postId: string) => eventPostsApi.remove(eventId, postId),
        onSuccess: () => {
            toast.success('Posto removido.');
            queryClient.invalidateQueries({ queryKey: ['events', eventId] });
        },
        onError: (error: any) => toast.error(error?.response?.data?.message || 'Não foi possível remover o posto.'),
    });

    const movePostMutation = useMutation({
        mutationFn: ({ postId, posX, posY }: { postId: string; posX: number; posY: number }) =>
            eventPostsApi.update(eventId, postId, { posX, posY }),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['events', eventId] });
            setDragging(null);
        },
        onError: async (error: any) => {
            toast.error(error?.response?.data?.message || 'Não foi possível mover o posto.');
            await queryClient.invalidateQueries({ queryKey: ['events', eventId] });
            setDragging(null);
        },
    });

    const clampRatio = (value: number) => Math.min(1, Math.max(0, value));

    const relativePosFromEvent = (clientX: number, clientY: number) => {
        const rect = canvasRef.current!.getBoundingClientRect();
        return { x: clampRatio((clientX - rect.left) / rect.width), y: clampRatio((clientY - rect.top) / rect.height) };
    };

    /** Arrastar um posto reposiciona (persiste no pointerup); um clique sem arrastar continua abrindo o popover. */
    const handlePinPointerDown = (e: React.PointerEvent<HTMLButtonElement>, post: EventPost) => {
        if (isPlacing) return;
        e.stopPropagation();
        draggedRef.current = false;

        const handleMove = (moveEvent: PointerEvent) => {
            draggedRef.current = true;
            setDragging({ postId: post.id, ...relativePosFromEvent(moveEvent.clientX, moveEvent.clientY) });
        };
        const handleUp = (upEvent: PointerEvent) => {
            window.removeEventListener('pointermove', handleMove);
            window.removeEventListener('pointerup', handleUp);
            if (draggedRef.current) {
                // Mantém `dragging` (já na posição final) até a mutation assentar — evita
                // o pino "voltar" pra posição antiga por um instante enquanto o cache não atualiza.
                const finalPos = relativePosFromEvent(upEvent.clientX, upEvent.clientY);
                setDragging({ postId: post.id, ...finalPos });
                movePostMutation.mutate({ postId: post.id, posX: finalPos.x, posY: finalPos.y });
            } else {
                setDragging(null);
            }
        };
        window.addEventListener('pointermove', handleMove);
        window.addEventListener('pointerup', handleUp);
    };

    const handlePinClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (draggedRef.current) {
            // Só suprime o clique que ENCERROU o arrasto — sem isso o popover abriria sozinho logo após soltar.
            e.preventDefault();
            draggedRef.current = false;
        }
    };

    const shiftOptions = useMemo(() => {
        const seen = new Map<string, { shiftStart: string; shiftEnd: string }>();
        (designations ?? []).forEach((d) => seen.set(`${d.shiftStart}|${d.shiftEnd}`, { shiftStart: d.shiftStart, shiftEnd: d.shiftEnd }));
        return Array.from(seen.entries()).sort(([, a], [, b]) => +new Date(a.shiftStart) - +new Date(b.shiftStart));
    }, [designations]);

    const designationsForPost = (postId: string) =>
        (designations ?? []).filter((d) => {
            if (d.post?.id !== postId) return false;
            if (shiftFilter === 'all') return true;
            return `${d.shiftStart}|${d.shiftEnd}` === shiftFilter;
        });

    const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!isPlacing) return;
        const rect = e.currentTarget.getBoundingClientRect();
        setPendingPos({ x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height });
    };

    const handleUploadChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) uploadFloorPlanMutation.mutate(file);
    };

    if (!floorPlanUrl) {
        return (
            <FloorPlanUploadBox>
                <Upload size={24} />
                {uploadFloorPlanMutation.isPending ? 'Enviando...' : 'Enviar imagem da planta baixa do local'}
                <input type="file" accept="image/*" onChange={handleUploadChange} disabled={uploadFloorPlanMutation.isPending} />
            </FloorPlanUploadBox>
        );
    }

    return (
        <div>
            <ToolbarRow style={{ justifyContent: 'space-between' }}>
                <Select value={shiftFilter} onChange={(e) => setShiftFilter(e.target.value)} style={{ maxWidth: 260 }}>
                    <option value="all">Todos os turnos</option>
                    {shiftOptions.map(([key, s]) => (
                        <option key={key} value={key}>{formatAppDate(s.shiftStart, 'dd/MM HH:mm')} — {formatAppDate(s.shiftEnd, 'HH:mm')}</option>
                    ))}
                </Select>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <Button $variant={isPlacing ? 'primary' : 'secondary'} onClick={() => { setIsPlacing((v) => !v); setPendingPos(null); }}>
                        <MapPin size={14} /> {isPlacing ? 'Clique na planta para posicionar' : 'Adicionar posto'}
                    </Button>
                    <FloorPlanUploadBox as="label" style={{ padding: '0.5rem 0.9rem', border: 'none' }}>
                        <Button as="span" $variant="ghost"><Upload size={14} /> Trocar planta</Button>
                        <input type="file" accept="image/*" onChange={handleUploadChange} disabled={uploadFloorPlanMutation.isPending} />
                    </FloorPlanUploadBox>
                </div>
            </ToolbarRow>

            {posts.length > 0 && !isPlacing && (
                <p style={{ fontSize: '0.75rem', color: '#888', marginTop: 0, marginBottom: '0.5rem' }}>
                    Arraste um posto na planta para reposicioná-lo.
                </p>
            )}

            <FloorPlanCanvas ref={canvasRef} $placing={isPlacing} onClick={handleCanvasClick}>
                <img src={floorPlanUrl} alt="Planta baixa do local" />
                {posts.map((post) => {
                    if (post.posX == null || post.posY == null) return null;
                    const isDraggingThis = dragging?.postId === post.id;
                    const posX = isDraggingThis ? dragging.x : post.posX;
                    const posY = isDraggingThis ? dragging.y : post.posY;
                    const occupants = designationsForPost(post.id);
                    const tone = post.capacity
                        ? occupants.length >= post.capacity ? 'success' : 'warning'
                        : 'info';
                    return (
                        <Popover.Root key={post.id}>
                            <Popover.Trigger asChild>
                                <Pin
                                    $tone={tone}
                                    $dragging={isDraggingThis}
                                    style={{ left: `${posX * 100}%`, top: `${posY * 100}%` }}
                                    onPointerDown={(e) => handlePinPointerDown(e, post)}
                                    onClick={handlePinClick}
                                >
                                    {occupants.length}{post.capacity ? `/${post.capacity}` : ''}
                                </Pin>
                            </Popover.Trigger>
                            <Popover.Portal>
                                <PostPopoverContent side="top" sideOffset={8}>
                                    <PostDetails post={post} occupants={occupants} onRemove={() => removePostMutation.mutate(post.id)} />
                                </PostPopoverContent>
                            </Popover.Portal>
                        </Popover.Root>
                    );
                })}
                {pendingPos && <PendingPin style={{ left: `${pendingPos.x * 100}%`, top: `${pendingPos.y * 100}%` }} />}
            </FloorPlanCanvas>

            {posts.length === 0 && <EmptyState>Nenhum posto cadastrado ainda — clique em "Adicionar posto" e depois na planta.</EmptyState>}

            <Modal
                open={pendingPos !== null}
                onOpenChange={(open) => { if (!open) setPendingPos(null); }}
                title="Novo posto de atuação"
            >
                <Form
                    onSubmit={handleSubmit((data) => {
                        if (!pendingPos) return;
                        createPostMutation.mutate({
                            name: data.name,
                            capacity: data.capacity ? Number(data.capacity) : undefined,
                            posX: pendingPos.x,
                            posY: pendingPos.y,
                        });
                        reset();
                    })}
                >
                    <Field>
                        <Label htmlFor="post-name">Nome do posto</Label>
                        <Input id="post-name" placeholder="ex: Portão A, Palco, Enfermaria" {...register('name', { required: true })} />
                    </Field>
                    <Field>
                        <Label htmlFor="post-capacity">Capacidade (opcional)</Label>
                        <Input id="post-capacity" type="number" min={1} {...register('capacity')} />
                    </Field>
                    <FormActions>
                        <Button type="button" $variant="secondary" onClick={() => setPendingPos(null)}>Cancelar</Button>
                        <Button type="submit" disabled={createPostMutation.isPending}>{createPostMutation.isPending ? 'Salvando...' : 'Adicionar'}</Button>
                    </FormActions>
                </Form>
            </Modal>
        </div>
    );
}

function PostDetails({ post, occupants, onRemove }: { post: EventPost; occupants: Designation[]; onRemove: () => void }) {
    const teams = new Map<string, { name: string; members: Designation[] }>();
    const solo: Designation[] = [];
    occupants.forEach((d) => {
        if (d.team) {
            const group = teams.get(d.team.id) ?? { name: d.team.name, members: [] };
            group.members.push(d);
            teams.set(d.team.id, group);
        } else {
            solo.push(d);
        }
    });

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <strong>{post.name}</strong>
                <button
                    type="button"
                    onClick={onRemove}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', opacity: 0.6 }}
                    aria-label="Remover posto"
                >
                    <X size={14} />
                </button>
            </div>
            {post.capacity != null && <span style={{ fontSize: '0.75rem', color: '#888' }}>Capacidade: {occupants.length}/{post.capacity}</span>}

            {occupants.length === 0 && <p style={{ marginTop: '0.5rem', fontSize: '0.75rem' }}>Ninguém escalado aqui ainda.</p>}

            {solo.map((d) => (
                <p key={d.id} style={{ marginTop: '0.35rem', fontSize: '0.75rem' }}>{d.staffMember.user.name} — {d.role}</p>
            ))}

            {Array.from(teams.values()).map((group) => (
                <TeamGroup key={group.name}>
                    <strong>{group.name}</strong>
                    {group.members.map((d) => <span key={d.id}>{d.staffMember.user.name} — {d.role}</span>)}
                </TeamGroup>
            ))}
        </div>
    );
}

function MeetingTab({ eventId, meeting }: { eventId: string; meeting: { agenda: string | null; minutes: string | null; meetUrl: string | null } | null }) {
    const queryClient = useQueryClient();
    const { user } = useAuth();
    // Ver a reunião é aberto a todo mundo (qualquer um pode conferir a pauta antes de
    // entrar), mas editar pauta/ata/link exige events:manage no backend — sem esconder
    // o formulário, quem não tem a permissão via um 403 inesperado ao clicar em Salvar.
    const canEditMeeting = hasPermission(user, 'events:manage');
    const { register, handleSubmit } = useForm({
        defaultValues: { agenda: meeting?.agenda ?? '', minutes: meeting?.minutes ?? '', meetUrl: meeting?.meetUrl ?? '' },
    });

    const updateMutation = useMutation({
        mutationFn: (input: { agenda?: string; minutes?: string; meetUrl?: string }) => meetingsApi.update(eventId, input),
        onSuccess: () => {
            toast.success('Reunião atualizada.');
            queryClient.invalidateQueries({ queryKey: ['events', eventId] });
        },
        onError: (error: any) => toast.error(error?.response?.data?.message || 'Não foi possível salvar.'),
    });

    return (
        <div>
            {meeting?.meetUrl && (
                <div style={{ marginBottom: '1rem' }}>
                    <Button as="a" href={meeting.meetUrl} target="_blank" rel="noreferrer">
                        <Video size={16} /> Entrar no Google Meet
                    </Button>
                </div>
            )}
            {canEditMeeting ? (
                <Form onSubmit={handleSubmit((data) => updateMutation.mutate({ ...data, meetUrl: data.meetUrl || undefined }))}>
                    <Field>
                        <Label htmlFor="meetUrl">Link do Google Meet</Label>
                        <Input id="meetUrl" placeholder="Gerado automaticamente se você conectou o Google Calendar" {...register('meetUrl')} />
                    </Field>
                    <Field>
                        <Label htmlFor="agenda">Pauta</Label>
                        <Textarea id="agenda" {...register('agenda')} />
                    </Field>
                    <Field>
                        <Label htmlFor="minutes">Ata</Label>
                        <Textarea id="minutes" {...register('minutes')} />
                    </Field>
                    <FormActions>
                        <Button type="submit" disabled={updateMutation.isPending}>{updateMutation.isPending ? 'Salvando...' : 'Salvar'}</Button>
                    </FormActions>
                </Form>
            ) : (
                <InfoRow style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.75rem' }}>
                    <span><strong>Pauta:</strong> {meeting?.agenda || 'Não informada.'}</span>
                    <span><strong>Ata:</strong> {meeting?.minutes || 'Ainda não registrada.'}</span>
                </InfoRow>
            )}
        </div>
    );
}

function AttendanceTab({ eventId }: { eventId: string }) {
    const [modalOpen, setModalOpen] = useState(false);
    const [userId, setUserId] = useState('');
    const [status, setStatus] = useState<AttendanceStatus>('PRESENT');
    const queryClient = useQueryClient();
    const { user } = useAuth();

    const { data: attendance } = useQuery({ queryKey: ['events', eventId, 'attendance'], queryFn: () => meetingsApi.getAttendance(eventId) });
    // PUT .../meeting/attendance é liberado a qualquer autenticado no backend (reunião é
    // aberta a toda a organização por design — ver meetings.service.ts), então o seletor
    // de pessoa usa o roster enxuto (só id+nome, GET /users/roster) em vez da listagem
    // administrativa completa (`peopleApi.list`, que exige `people:manage`).
    const { data: roster } = useQuery({ queryKey: ['people', 'roster'], queryFn: () => peopleApi.roster() });

    const markMutation = useMutation({
        mutationFn: (records: { userId: string; status: AttendanceStatus }[]) => meetingsApi.markAttendance(eventId, records),
        onSuccess: () => {
            toast.success('Presença registrada.');
            queryClient.invalidateQueries({ queryKey: ['events', eventId, 'attendance'] });
            setModalOpen(false);
            setUserId('');
        },
        onError: (error: any) => toast.error(error?.response?.data?.message || 'Não foi possível registrar a presença.'),
    });

    // GROUP_ADMIN/ORG_ADMIN/SUPER_ADMIN e quem tem `events:manage` podem
    // registrar ou corrigir a presença de qualquer pessoa; os demais só
    // marcam a própria presença, uma única vez (regra espelhada no backend).
    const canManageOthers =
        user?.role === 'GROUP_ADMIN' ||
        user?.role === 'ORG_ADMIN' ||
        user?.role === 'SUPER_ADMIN' ||
        (user?.permissions ?? []).includes('events:manage');

    const recordedUserIds = new Set((attendance ?? []).map((a) => a.user.id));
    const myRecord = user ? (attendance ?? []).find((a) => a.user.id === user.id) : undefined;

    return (
        <>
            <ToolbarRow>
                {!myRecord && user && (
                    <>
                        <Button
                            onClick={() => markMutation.mutate([{ userId: user.id, status: 'PRESENT' }])}
                            disabled={markMutation.isPending}
                        >
                            <Plus size={16} /> Marcar minha presença
                        </Button>
                        <Button
                            $variant="secondary"
                            onClick={() => markMutation.mutate([{ userId: user.id, status: 'JUSTIFIED_ABSENT' }])}
                            disabled={markMutation.isPending}
                        >
                            Registrar ausência justificada
                        </Button>
                    </>
                )}
                {canManageOthers && (
                    <Button $variant="secondary" onClick={() => setModalOpen(true)}>
                        <Plus size={16} /> Registrar presença de outra pessoa
                    </Button>
                )}
            </ToolbarRow>
            <TableWrapper>
                <Table>
                    <Thead><tr><Th>Pessoa</Th><Th>Status</Th>{canManageOthers && <Th>Alterar</Th>}</tr></Thead>
                    <tbody>
                        {(attendance ?? []).map((a) => (
                            <Tr key={a.user.id}>
                                <Td>{a.user.name}</Td>
                                <Td><Badge $tone={a.status === 'PRESENT' ? 'success' : 'neutral'}>{ATTENDANCE_LABEL[a.status]}</Badge></Td>
                                {canManageOthers && (
                                    <Td>
                                        <Select value={a.status} onChange={(e) => markMutation.mutate([{ userId: a.user.id, status: e.target.value as AttendanceStatus }])}>
                                            <option value="PRESENT">{ATTENDANCE_LABEL.PRESENT}</option>
                                            <option value="ABSENT">{ATTENDANCE_LABEL.ABSENT}</option>
                                            <option value="JUSTIFIED_ABSENT">{ATTENDANCE_LABEL.JUSTIFIED_ABSENT}</option>
                                        </Select>
                                    </Td>
                                )}
                            </Tr>
                        ))}
                    </tbody>
                </Table>
                {(attendance ?? []).length === 0 && <EmptyState>Nenhuma presença registrada ainda.</EmptyState>}
            </TableWrapper>

            {canManageOthers && (
                <Modal open={modalOpen} onOpenChange={setModalOpen} title="Registrar presença de outra pessoa">
                    <Form onSubmit={(e) => { e.preventDefault(); if (userId) markMutation.mutate([{ userId, status }]); }}>
                        <Field>
                            <Label htmlFor="user">Pessoa</Label>
                            <Select id="user" value={userId} onChange={(e) => setUserId(e.target.value)}>
                                <option value="">Selecione</option>
                                {(roster ?? []).filter((p) => !recordedUserIds.has(p.id)).map((p) => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </Select>
                        </Field>
                        <Field>
                            <Label htmlFor="status">Status</Label>
                            <Select id="status" value={status} onChange={(e) => setStatus(e.target.value as AttendanceStatus)}>
                                <option value="PRESENT">{ATTENDANCE_LABEL.PRESENT}</option>
                                <option value="ABSENT">{ATTENDANCE_LABEL.ABSENT}</option>
                                <option value="JUSTIFIED_ABSENT">{ATTENDANCE_LABEL.JUSTIFIED_ABSENT}</option>
                            </Select>
                        </Field>
                        <FormActions>
                            <Button type="button" $variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
                            <Button type="submit" disabled={!userId || markMutation.isPending}>{markMutation.isPending ? 'Salvando...' : 'Registrar'}</Button>
                        </FormActions>
                    </Form>
                </Modal>
            )}
        </>
    );
}

// Mesma allowlist do contexto 'event-files' em backend/src/media/media.service.ts —
// mantém a validação do lado do cliente consistente com o que o backend aceita.
const EVENT_FILE_ALLOWED_TYPES = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/svg+xml',
    'audio/webm',
    'audio/mp4',
    'audio/ogg',
    'audio/mpeg',
    'audio/wav',
];
const EVENT_FILE_MAX_SIZE = 25 * 1024 * 1024; // 25MB — mesmo padrão de media.service.ts

function FilePreview({ file }: { file: EventFile }) {
    const [previewOpen, setPreviewOpen] = useState(false);
    const url = file.externalUrl;
    const mime = file.mimeType ?? '';
    const canPreview = Boolean(url) && (mime.startsWith('image/') || mime === 'application/pdf' || mime.startsWith('audio/'));

    if (!url) return <>—</>;

    return (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12 }}>
            {canPreview && (
                <button
                    type="button"
                    onClick={() => setPreviewOpen(true)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0, font: 'inherit' }}
                >
                    <Eye size={12} /> Visualizar
                </button>
            )}
            <a href={url} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                Abrir <ExternalLink size={12} />
            </a>
            {canPreview && (
                <Modal open={previewOpen} onOpenChange={setPreviewOpen} title={file.name}>
                    {mime.startsWith('image/') ? (
                        <img src={url} alt={file.name} style={{ maxWidth: '100%', maxHeight: '70vh', display: 'block', margin: '0 auto' }} />
                    ) : mime.startsWith('audio/') ? (
                        <audio src={url} controls style={{ width: '100%' }} />
                    ) : (
                        <iframe src={url} title={file.name} style={{ width: '100%', height: '70vh', border: 'none' }} />
                    )}
                </Modal>
            )}
        </div>
    );
}

function FilesTab({ eventId }: { eventId: string }) {
    const [modalOpen, setModalOpen] = useState(false);
    const [mode, setMode] = useState<'link' | 'upload' | 'record'>('link');
    const [file, setFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [renamingFile, setRenamingFile] = useState<EventFile | null>(null);
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const canManageFiles = hasPermission(user, 'events:manage');
    const { data: files } = useQuery({ queryKey: ['events', eventId, 'files'], queryFn: () => eventFilesApi.list(eventId) });
    const { register, handleSubmit, reset, watch } = useForm<{ name: string; externalUrl: string }>();
    const name = watch('name');
    const renameForm = useForm<{ name: string }>();

    const createMutation = useMutation({
        mutationFn: async (input: { name: string; externalUrl: string }) => {
            if (mode === 'upload' || mode === 'record') {
                if (!file) throw new Error(mode === 'record' ? 'Grave um áudio antes de salvar.' : 'Selecione um arquivo para enviar.');
                if (!EVENT_FILE_ALLOWED_TYPES.includes(file.type)) {
                    throw new Error('Tipo de arquivo não permitido. Envie PDF, DOC, DOCX, uma imagem ou um áudio.');
                }
                if (file.size > EVENT_FILE_MAX_SIZE) {
                    throw new Error('O arquivo deve ter no máximo 25MB.');
                }
                setIsUploading(true);
                try {
                    const { fileUrl, storageKey } = await mediaApi.upload(file, 'event-files');
                    return eventFilesApi.create(eventId, { name: input.name, storageKey, externalUrl: fileUrl, mimeType: file.type });
                } finally {
                    setIsUploading(false);
                }
            }
            return eventFilesApi.create(eventId, { name: input.name, externalUrl: input.externalUrl });
        },
        onSuccess: () => {
            toast.success('Arquivo adicionado.');
            queryClient.invalidateQueries({ queryKey: ['events', eventId, 'files'] });
            setModalOpen(false);
        },
        onError: (error: any) => toast.error(error?.response?.data?.message || error?.message || 'Não foi possível adicionar o arquivo.'),
    });

    const openModal = () => {
        reset({ name: '', externalUrl: '' });
        setMode('link');
        setFile(null);
        setModalOpen(true);
    };

    const canSubmit = mode === 'link' ? true : Boolean(file);

    const renameMutation = useMutation({
        mutationFn: (input: { name: string }) => eventFilesApi.update(eventId, renamingFile!.id, { name: input.name }),
        onSuccess: () => {
            toast.success('Arquivo renomeado.');
            queryClient.invalidateQueries({ queryKey: ['events', eventId, 'files'] });
            setRenamingFile(null);
        },
        onError: (error: any) => toast.error(error?.response?.data?.message || 'Não foi possível renomear o arquivo.'),
    });

    const removeMutation = useMutation({
        mutationFn: (fileId: string) => eventFilesApi.remove(eventId, fileId),
        onSuccess: () => {
            toast.success('Arquivo removido.');
            queryClient.invalidateQueries({ queryKey: ['events', eventId, 'files'] });
        },
        onError: (error: any) => toast.error(error?.response?.data?.message || 'Não foi possível remover o arquivo.'),
    });

    const openRenameModal = (f: EventFile) => {
        renameForm.reset({ name: f.name });
        setRenamingFile(f);
    };

    return (
        <>
            <ToolbarRow>
                <Button onClick={openModal}>
                    <Plus size={16} /> Adicionar link/arquivo
                </Button>
            </ToolbarRow>
            <TableWrapper>
                <Table>
                    <Thead><tr><Th>Nome</Th><Th>Link</Th><Th>Adicionado em</Th>{canManageFiles && <Th></Th>}</tr></Thead>
                    <tbody>
                        {(files ?? []).map((f) => (
                            <Tr key={f.id}>
                                <Td>{f.name}</Td>
                                <Td><FilePreview file={f} /></Td>
                                <Td>{formatAppDate(f.createdAt, 'dd/MM/yyyy')}</Td>
                                {canManageFiles && (
                                    <Td>
                                        <Button $variant="ghost" onClick={() => openRenameModal(f)}>
                                            <Pencil size={14} />
                                        </Button>
                                        <Button
                                            $variant="ghost"
                                            onClick={() => {
                                                if (window.confirm(`Remover o arquivo "${f.name}"?`)) {
                                                    removeMutation.mutate(f.id);
                                                }
                                            }}
                                        >
                                            <Trash2 size={14} />
                                        </Button>
                                    </Td>
                                )}
                            </Tr>
                        ))}
                    </tbody>
                </Table>
                {(files ?? []).length === 0 && <EmptyState>Nenhum arquivo ou link anexado ainda.</EmptyState>}
            </TableWrapper>

            <Modal open={modalOpen} onOpenChange={setModalOpen} title="Adicionar link/arquivo">
                <Form onSubmit={handleSubmit((data) => createMutation.mutate(data))}>
                    <Field>
                        <Label htmlFor="name">Nome</Label>
                        <Input id="name" placeholder="ex: Pauta da reunião" {...register('name', { required: true })} />
                    </Field>

                    <Field>
                        <Label htmlFor="mode">Tipo de anexo</Label>
                        <Select id="mode" value={mode} onChange={(e) => { setMode(e.target.value as 'link' | 'upload' | 'record'); setFile(null); }}>
                            <option value="link">Link (URL já hospedada)</option>
                            <option value="upload">Enviar arquivo</option>
                            <option value="record">Gravar áudio</option>
                        </Select>
                    </Field>

                    {mode === 'link' && (
                        <Field>
                            <Label htmlFor="externalUrl">Link</Label>
                            <Input id="externalUrl" placeholder="https://..." {...register('externalUrl', { required: mode === 'link' })} />
                        </Field>
                    )}
                    {mode === 'upload' && (
                        <Field>
                            <Label htmlFor="file">Arquivo</Label>
                            <input
                                id="file"
                                type="file"
                                accept={EVENT_FILE_ALLOWED_TYPES.join(',')}
                                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                            />
                            <HelpText>PDF, DOC, DOCX ou imagem, até 25MB.</HelpText>
                        </Field>
                    )}
                    {mode === 'record' && (
                        <Field>
                            <Label>Áudio</Label>
                            <AudioRecorder onRecorded={setFile} disabled={createMutation.isPending} />
                        </Field>
                    )}

                    <FormActions>
                        <Button type="button" $variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
                        <Button type="submit" disabled={!name || !canSubmit || createMutation.isPending}>
                            {isUploading ? 'Enviando...' : createMutation.isPending ? 'Salvando...' : 'Adicionar'}
                        </Button>
                    </FormActions>
                </Form>
            </Modal>

            <Modal open={!!renamingFile} onOpenChange={(open) => !open && setRenamingFile(null)} title="Renomear arquivo">
                <Form onSubmit={renameForm.handleSubmit((data) => renameMutation.mutate(data))}>
                    <Field>
                        <Label htmlFor="rename-name">Nome</Label>
                        <Input id="rename-name" {...renameForm.register('name', { required: true })} />
                    </Field>
                    <FormActions>
                        <Button type="button" $variant="secondary" onClick={() => setRenamingFile(null)}>Cancelar</Button>
                        <Button type="submit" disabled={renameMutation.isPending}>
                            {renameMutation.isPending ? 'Salvando...' : 'Salvar'}
                        </Button>
                    </FormActions>
                </Form>
            </Modal>
        </>
    );
}
