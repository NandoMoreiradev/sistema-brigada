// frontend/src/pages/EventDetail.tsx
//
// Detalhe de um evento polimórfico. O conjunto de abas muda conforme
// `event.kind` (decisão 2 do docs/decisoes.md): assembleia/congresso/atuação
// de brigada mostram Escala + Ocorrências; reunião mostra Pauta/Ata + Presença.
// Arquivos é comum aos dois.

import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import * as Tabs from '@radix-ui/react-tabs';
import styled from 'styled-components';
import { ArrowLeft, Plus, CalendarClock, Video, ExternalLink, Pencil, Trash2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageLayout } from '@/components/layout/PageLayout';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Field, Label, Input, Select, Textarea, Form, FormActions, FieldRow } from '@/components/ui/FormField';
import { Table, TableWrapper, Thead, Tr, Th, Td, EmptyState, Badge } from '@/components/ui/Table';
import {
    eventsApi,
    designationsApi,
    occurrenceReportsApi,
    meetingsApi,
    eventFilesApi,
    type DesignationStatus,
    type AppEvent,
} from '@/services/events';
import { mediaApi } from '@/services/media';
import { staffApi } from '@/services/staff';
import { peopleApi } from '@/services/people';
import { toast } from '@/utils/toast';
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

const HeaderActions = styled.div`
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
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
        <PageLayout title={event.title} subtitle={formatAppDate(event.startDate, 'dd/MM/yyyy HH:mm')} icon={<CalendarClock size={16} />}>
            <BackLink onClick={() => navigate('/events')}>
                <ArrowLeft size={14} /> Voltar para eventos
            </BackLink>

            <HeaderActions>
                <EditEventButton event={event} />
                <Button $variant="ghost" onClick={handleDelete} disabled={removeMutation.isPending}>
                    <Trash2 size={14} /> Excluir evento
                </Button>
            </HeaderActions>

            <InfoRow>
                {event.location && <span><strong>Local:</strong> {event.location}</span>}
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                    <strong>Status:</strong>
                    <Badge $tone={STATUS_TONE[event.status]}>{STATUS_LABEL[event.status]}</Badge>
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
                </span>
                {isOperation && event.operation?.estimatedAudienceCount != null && (
                    <span><strong>Público estimado:</strong> {event.operation.estimatedAudienceCount}</span>
                )}
            </InfoRow>

            <Tabs.Root defaultValue={isOperation ? 'designations' : 'meeting'}>
                <TabsList>
                    {isOperation ? (
                        <>
                            <TabsTrigger value="designations">Escala</TabsTrigger>
                            <TabsTrigger value="occurrences">Ocorrências</TabsTrigger>
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

interface EditEventForm {
    title: string;
    location: string;
    startDate: string;
    endDate: string;
    estimatedAudienceCount: string;
    notes: string;
}

/** Botão + modal de edição do tronco do evento. `kind` é imutável (decisão 2 do docs/decisoes.md) — a pauta de reunião tem endpoint próprio (aba Reunião). */
function EditEventButton({ event }: { event: AppEvent }) {
    const [modalOpen, setModalOpen] = useState(false);
    const queryClient = useQueryClient();
    const isOperation = event.kind !== 'REUNIAO';

    const { register, handleSubmit, reset } = useForm<EditEventForm>();

    const openModal = () => {
        reset({
            title: event.title,
            location: event.location ?? '',
            startDate: toDateTimeLocalValue(event.startDate),
            endDate: toDateTimeLocalValue(event.endDate),
            estimatedAudienceCount: event.operation?.estimatedAudienceCount != null ? String(event.operation.estimatedAudienceCount) : '',
            notes: event.operation?.notes ?? '',
        });
        setModalOpen(true);
    };

    const updateMutation = useMutation({
        mutationFn: (input: EditEventForm) =>
            eventsApi.update(event.id, {
                title: input.title,
                location: input.location || undefined,
                startDate: input.startDate,
                endDate: input.endDate || undefined,
                estimatedAudienceCount: input.estimatedAudienceCount ? Number(input.estimatedAudienceCount) : undefined,
                notes: input.notes || undefined,
            }),
        onSuccess: () => {
            toast.success('Evento atualizado.');
            queryClient.invalidateQueries({ queryKey: ['events', event.id] });
            queryClient.invalidateQueries({ queryKey: ['events'] });
            setModalOpen(false);
        },
        onError: (error: any) => toast.error(error?.response?.data?.message || 'Não foi possível salvar as alterações.'),
    });

    return (
        <>
            <Button $variant="secondary" onClick={openModal}>
                <Pencil size={14} /> Editar evento
            </Button>
            <Modal open={modalOpen} onOpenChange={setModalOpen} title={`Editar: ${KIND_LABEL[event.kind]}`} width="560px">
                <Form onSubmit={handleSubmit((data) => updateMutation.mutate(data))}>
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
                        <Button type="button" $variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
                        <Button type="submit" disabled={updateMutation.isPending}>{updateMutation.isPending ? 'Salvando...' : 'Salvar'}</Button>
                    </FormActions>
                </Form>
            </Modal>
        </>
    );
}

function DesignationsTab({ eventId }: { eventId: string }) {
    const [modalOpen, setModalOpen] = useState(false);
    const queryClient = useQueryClient();

    const { data: designations } = useQuery({ queryKey: ['events', eventId, 'designations'], queryFn: () => designationsApi.list(eventId) });
    const { data: staff } = useQuery({ queryKey: ['staff'], queryFn: () => staffApi.list() });

    const { register, handleSubmit, reset } = useForm<{ staffMemberId: string; role: string; shiftStart: string; shiftEnd: string }>();

    const createMutation = useMutation({
        mutationFn: (input: { staffMemberId: string; role: string; shiftStart: string; shiftEnd: string }) => designationsApi.create(eventId, input),
        onSuccess: () => {
            toast.success('Designação criada.');
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

    return (
        <>
            <ToolbarRow>
                <Button onClick={() => { reset({ staffMemberId: '', role: '', shiftStart: '', shiftEnd: '' }); setModalOpen(true); }}>
                    <Plus size={16} /> Nova designação
                </Button>
            </ToolbarRow>
            <TableWrapper>
                <Table>
                    <Thead>
                        <tr>
                            <Th>Brigadista</Th>
                            <Th>Função</Th>
                            <Th>Turno</Th>
                            <Th>Status</Th>
                            <Th>Alterar</Th>
                        </tr>
                    </Thead>
                    <tbody>
                        {(designations ?? []).map((d) => (
                            <Tr key={d.id}>
                                <Td>{d.staffMember.user.name}</Td>
                                <Td>{d.role}</Td>
                                <Td>{formatAppDate(d.shiftStart, 'dd/MM HH:mm')} — {formatAppDate(d.shiftEnd, 'HH:mm')}</Td>
                                <Td><Badge $tone={d.status === 'CONFIRMED' ? 'success' : d.status === 'DECLINED' ? 'danger' : 'warning'}>{DESIGNATION_STATUS_LABEL[d.status]}</Badge></Td>
                                <Td>
                                    <Select value={d.status} onChange={(e) => statusMutation.mutate({ designationId: d.id, status: e.target.value as DesignationStatus })}>
                                        <option value="PENDING">Pendente</option>
                                        <option value="CONFIRMED">Confirmada</option>
                                        <option value="DECLINED">Recusada</option>
                                    </Select>
                                </Td>
                            </Tr>
                        ))}
                    </tbody>
                </Table>
                {(designations ?? []).length === 0 && <EmptyState>Nenhuma designação criada ainda.</EmptyState>}
            </TableWrapper>

            <Modal open={modalOpen} onOpenChange={setModalOpen} title="Nova designação">
                <Form onSubmit={handleSubmit((data) => createMutation.mutate(data))}>
                    <Field>
                        <Label htmlFor="staffMemberId">Brigadista</Label>
                        <Select id="staffMemberId" {...register('staffMemberId', { required: true })}>
                            <option value="">Selecione</option>
                            {(staff ?? []).filter((s) => s.status === 'ACTIVE').map((s) => (
                                <option key={s.id} value={s.id}>{s.user.name}</option>
                            ))}
                        </Select>
                    </Field>
                    <Field>
                        <Label htmlFor="role">Função no evento</Label>
                        <Input id="role" placeholder="ex: Brigadista, Coordenador" {...register('role', { required: true })} />
                    </Field>
                    <Field>
                        <Label htmlFor="shiftStart">Início do turno</Label>
                        <Input id="shiftStart" type="datetime-local" {...register('shiftStart', { required: true })} />
                    </Field>
                    <Field>
                        <Label htmlFor="shiftEnd">Fim do turno</Label>
                        <Input id="shiftEnd" type="datetime-local" {...register('shiftEnd', { required: true })} />
                    </Field>
                    <FormActions>
                        <Button type="button" $variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
                        <Button type="submit" disabled={createMutation.isPending}>{createMutation.isPending ? 'Salvando...' : 'Designar'}</Button>
                    </FormActions>
                </Form>
            </Modal>
        </>
    );
}

function OccurrencesTab({ eventId }: { eventId: string }) {
    const [modalOpen, setModalOpen] = useState(false);
    const queryClient = useQueryClient();
    const { data: reports } = useQuery({ queryKey: ['events', eventId, 'occurrence-reports'], queryFn: () => occurrenceReportsApi.list(eventId) });
    const { register, handleSubmit, reset } = useForm<{ type: string; title: string; description: string }>();

    const createMutation = useMutation({
        mutationFn: (input: { type: string; title: string; description?: string }) => occurrenceReportsApi.create(eventId, input),
        onSuccess: () => {
            toast.success('Relatório registrado.');
            queryClient.invalidateQueries({ queryKey: ['events', eventId, 'occurrence-reports'] });
            setModalOpen(false);
        },
        onError: (error: any) => toast.error(error?.response?.data?.message || 'Não foi possível registrar o relatório.'),
    });

    return (
        <>
            <ToolbarRow>
                <Button onClick={() => { reset({ type: 'GENERAL', title: '', description: '' }); setModalOpen(true); }}>
                    <Plus size={16} /> Novo relatório
                </Button>
            </ToolbarRow>
            <TableWrapper>
                <Table>
                    <Thead>
                        <tr><Th>Tipo</Th><Th>Título</Th><Th>Descrição</Th><Th>Data</Th></tr>
                    </Thead>
                    <tbody>
                        {(reports ?? []).map((r) => (
                            <Tr key={r.id}>
                                <Td><Badge>{OCCURRENCE_TYPES.find((t) => t.value === r.type)?.label ?? r.type}</Badge></Td>
                                <Td>{r.title}</Td>
                                <Td>{r.description || '—'}</Td>
                                <Td>{formatAppDate(r.createdAt, 'dd/MM/yyyy HH:mm')}</Td>
                            </Tr>
                        ))}
                    </tbody>
                </Table>
                {(reports ?? []).length === 0 && <EmptyState>Nenhum relatório de ocorrência registrado.</EmptyState>}
            </TableWrapper>

            <Modal open={modalOpen} onOpenChange={setModalOpen} title="Novo relatório de ocorrência">
                <Form onSubmit={handleSubmit((data) => createMutation.mutate(data))}>
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
                    <FormActions>
                        <Button type="button" $variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
                        <Button type="submit" disabled={createMutation.isPending}>{createMutation.isPending ? 'Salvando...' : 'Registrar'}</Button>
                    </FormActions>
                </Form>
            </Modal>
        </>
    );
}

function MeetingTab({ eventId, meeting }: { eventId: string; meeting: { agenda: string | null; minutes: string | null; meetUrl: string | null } | null }) {
    const queryClient = useQueryClient();
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
        </div>
    );
}

function AttendanceTab({ eventId }: { eventId: string }) {
    const [modalOpen, setModalOpen] = useState(false);
    const [userId, setUserId] = useState('');
    const [status, setStatus] = useState<AttendanceStatus>('PRESENT');
    const queryClient = useQueryClient();

    const { data: attendance } = useQuery({ queryKey: ['events', eventId, 'attendance'], queryFn: () => meetingsApi.getAttendance(eventId) });
    const { data: peopleData } = useQuery({ queryKey: ['people', {}], queryFn: () => peopleApi.list() });

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

    const recordedUserIds = new Set((attendance ?? []).map((a) => a.user.id));

    return (
        <>
            <ToolbarRow>
                <Button onClick={() => setModalOpen(true)}><Plus size={16} /> Registrar presença</Button>
            </ToolbarRow>
            <TableWrapper>
                <Table>
                    <Thead><tr><Th>Pessoa</Th><Th>Status</Th><Th>Alterar</Th></tr></Thead>
                    <tbody>
                        {(attendance ?? []).map((a) => (
                            <Tr key={a.user.id}>
                                <Td>{a.user.name}</Td>
                                <Td><Badge $tone={a.status === 'PRESENT' ? 'success' : 'neutral'}>{ATTENDANCE_LABEL[a.status]}</Badge></Td>
                                <Td>
                                    <Select value={a.status} onChange={(e) => markMutation.mutate([{ userId: a.user.id, status: e.target.value as AttendanceStatus }])}>
                                        <option value="PRESENT">{ATTENDANCE_LABEL.PRESENT}</option>
                                        <option value="ABSENT">{ATTENDANCE_LABEL.ABSENT}</option>
                                        <option value="JUSTIFIED_ABSENT">{ATTENDANCE_LABEL.JUSTIFIED_ABSENT}</option>
                                    </Select>
                                </Td>
                            </Tr>
                        ))}
                    </tbody>
                </Table>
                {(attendance ?? []).length === 0 && <EmptyState>Nenhuma presença registrada ainda.</EmptyState>}
            </TableWrapper>

            <Modal open={modalOpen} onOpenChange={setModalOpen} title="Registrar presença">
                <Form onSubmit={(e) => { e.preventDefault(); if (userId) markMutation.mutate([{ userId, status }]); }}>
                    <Field>
                        <Label htmlFor="user">Pessoa</Label>
                        <Select id="user" value={userId} onChange={(e) => setUserId(e.target.value)}>
                            <option value="">Selecione</option>
                            {(peopleData?.data ?? []).filter((p) => !recordedUserIds.has(p.id)).map((p) => (
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
        </>
    );
}

function FilesTab({ eventId }: { eventId: string }) {
    const [modalOpen, setModalOpen] = useState(false);
    const [mode, setMode] = useState<'link' | 'upload'>('link');
    const [file, setFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const queryClient = useQueryClient();
    const { data: files } = useQuery({ queryKey: ['events', eventId, 'files'], queryFn: () => eventFilesApi.list(eventId) });
    const { register, handleSubmit, reset, watch } = useForm<{ name: string; externalUrl: string }>();
    const name = watch('name');

    const createMutation = useMutation({
        mutationFn: async (input: { name: string; externalUrl: string }) => {
            if (mode === 'upload') {
                if (!file) throw new Error('Selecione um arquivo para enviar.');
                setIsUploading(true);
                try {
                    const { storageKey } = await mediaApi.upload(file, 'event-files');
                    return eventFilesApi.create(eventId, { name: input.name, storageKey });
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

    return (
        <>
            <ToolbarRow>
                <Button onClick={openModal}>
                    <Plus size={16} /> Adicionar link/arquivo
                </Button>
            </ToolbarRow>
            <TableWrapper>
                <Table>
                    <Thead><tr><Th>Nome</Th><Th>Link</Th><Th>Adicionado em</Th></tr></Thead>
                    <tbody>
                        {(files ?? []).map((f) => (
                            <Tr key={f.id}>
                                <Td>{f.name}</Td>
                                <Td>
                                    {f.externalUrl ? (
                                        <a href={f.externalUrl} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                            Abrir <ExternalLink size={12} />
                                        </a>
                                    ) : '—'}
                                </Td>
                                <Td>{formatAppDate(f.createdAt, 'dd/MM/yyyy')}</Td>
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
                        <Select id="mode" value={mode} onChange={(e) => { setMode(e.target.value as 'link' | 'upload'); setFile(null); }}>
                            <option value="link">Link (URL já hospedada)</option>
                            <option value="upload">Enviar arquivo</option>
                        </Select>
                    </Field>

                    {mode === 'link' ? (
                        <Field>
                            <Label htmlFor="externalUrl">Link</Label>
                            <Input id="externalUrl" placeholder="https://..." {...register('externalUrl', { required: mode === 'link' })} />
                        </Field>
                    ) : (
                        <Field>
                            <Label htmlFor="file">Arquivo</Label>
                            <input
                                id="file"
                                type="file"
                                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                            />
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
        </>
    );
}
