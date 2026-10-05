// frontend/src/pages/EventDetail.tsx
//
// Detalhe de um evento polimórfico. O conjunto de abas muda conforme
// `event.kind` (decisão 2 do docs/decisoes.md): assembleia/congresso/atuação
// de brigada mostram Escala + Ocorrências; reunião mostra Pauta/Ata + Presença.
// Arquivos é comum aos dois.

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import * as Tabs from '@radix-ui/react-tabs';
import styled from 'styled-components';
import { Plus, CalendarClock, Video, Pencil, Trash2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageLayout } from '@/components/layout/PageLayout';
import { Button } from '@/components/ui/Button';
import { ActionMenu, MoreButton } from '@/components/ui/ActionMenu';
import { PillSelect } from '@/components/ui/PillSelect';
import { Modal } from '@/components/ui/Modal';
import { Field, Label, Input, Select, Textarea, Form, FormActions, FieldRow } from '@/components/ui/FormField';
import { Table, TableWrapper, Thead, Tr, Th, Td, EmptyState, Badge } from '@/components/ui/Table';
import { eventsApi, meetingsApi, type AppEvent } from '@/services/events';
import { peopleApi } from '@/services/people';
import { toast } from '@/utils/toast';
import { useAuth } from '@/contexts/AuthContext';
import { hasPermission } from '@/utils/permissions';
import { formatAppDate, toDateTimeLocalValue } from '@/utils/datetime';
import { ScheduleTab } from '@/pages/event-detail/ScheduleTab';
import { MapTab } from '@/pages/event-detail/MapTab';
import { OccurrencesTab } from '@/pages/event-detail/OccurrencesTab';
import { FilesTab } from '@/pages/event-detail/FilesTab';
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
            `Excluir o evento "${event.title}"? Escala, ocorrências e arquivos associados deixarão de aparecer no sistema. Ele vai para a lixeira, de onde pode ser restaurado.`,
        );
        if (confirmed) removeMutation.mutate();
    };

    return (
        <PageLayout
            title={event.title}
            subtitle={[
                formatAppDate(event.startDate, 'dd/MM/yyyy HH:mm'),
                event.location,
                isOperation && event.operation?.estimatedAudienceCount != null ? `Público estimado: ${event.operation.estimatedAudienceCount.toLocaleString('pt-BR')}` : null,
            ].filter(Boolean).join(' · ')}
            icon={<CalendarClock size={16} />}
            onBack={() => navigate('/events')}
            backLabel="Voltar para eventos"
            badge={
                /* Um controle só: quem pode alterar vê a etiqueta como seletor; os demais, só a etiqueta. */
                canManageEvent ? (
                    <PillSelect
                        $tone={STATUS_TONE[event.status]}
                        aria-label="Status do evento"
                        value={event.status}
                        onChange={(e) => statusMutation.mutate(e.target.value as EventStatus)}
                        disabled={statusMutation.isPending}
                    >
                        {EVENT_STATUS_VALUES.map((status) => (
                            <option key={status} value={status}>{STATUS_LABEL[status]}</option>
                        ))}
                    </PillSelect>
                ) : (
                    <Badge $tone={STATUS_TONE[event.status]}>{STATUS_LABEL[event.status]}</Badge>
                )
            }
            actions={
                canManageEvent ? (
                    <>
                        <Button $variant="secondary" onClick={() => setEditOpen(true)}>
                            <Pencil size={16} /> Editar evento
                        </Button>
                        {/* Ação destrutiva fora do alcance de um toque acidental: atrás do menu, com confirmação. */}
                        <ActionMenu
                            trigger={<MoreButton label="Mais ações do evento" />}
                            entries={[{ label: 'Excluir evento', icon: <Trash2 size={14} />, danger: true, disabled: removeMutation.isPending, onSelect: handleDelete }]}
                        />
                    </>
                ) : undefined
            }
        >
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
                        <Tabs.Content value="designations"><ScheduleTab eventId={eventId} /></Tabs.Content>
                        <Tabs.Content value="occurrences"><OccurrencesTab eventId={eventId} /></Tabs.Content>
                        <Tabs.Content value="map"><MapTab eventId={eventId} canManage={canManageEvent} /></Tabs.Content>
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
