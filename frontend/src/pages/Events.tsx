// frontend/src/pages/Events.tsx
//
// Lista de eventos polimórficos (assembleia/congresso/atuação de brigada/
// reunião — decisão 2 do docs/decisoes.md). Turmas não aparecem aqui: têm
// tela própria em Courses.tsx, já que dependem de matrícula/aulas.

import { useState } from 'react';
import { CalendarClock, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { PageLayout } from '@/components/layout/PageLayout';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Field, Label, Input, Select, Textarea, ErrorText, Form, FormActions, FieldRow } from '@/components/ui/FormField';
import { Table, TableWrapper, Thead, Tr, Th, Td, EmptyState, Badge } from '@/components/ui/Table';
import { eventsApi, type EventKind, type CreateEventInput } from '@/services/events';
import { toast } from '@/utils/toast';
import type { EventStatus } from '@/types';

const schema = z.object({
    kind: z.enum(['ASSEMBLEIA', 'CONGRESSO', 'ATUACAO_BRIGADA', 'REUNIAO']),
    title: z.string().min(1, 'Informe o título'),
    location: z.string().optional(),
    startDate: z.string().min(1, 'Informe a data'),
    endDate: z.string().optional(),
    estimatedAudienceCount: z.string().optional(),
    notes: z.string().optional(),
    agenda: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

const KIND_LABEL: Record<EventKind, string> = {
    ASSEMBLEIA: 'Assembleia',
    CONGRESSO: 'Congresso',
    ATUACAO_BRIGADA: 'Atuação de brigada',
    REUNIAO: 'Reunião',
};

const STATUS_LABEL: Record<EventStatus, string> = {
    SCHEDULED: 'Agendado',
    ONGOING: 'Em andamento',
    COMPLETED: 'Concluído',
    CANCELLED: 'Cancelado',
};

const STATUS_TONE: Record<EventStatus, 'neutral' | 'success' | 'info' | 'danger'> = {
    SCHEDULED: 'info',
    ONGOING: 'success',
    COMPLETED: 'neutral',
    CANCELLED: 'danger',
};

export default function Events() {
    const [modalOpen, setModalOpen] = useState(false);
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const { data, isLoading } = useQuery({ queryKey: ['events'], queryFn: () => eventsApi.list() });

    const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<FormData>({
        resolver: zodResolver(schema),
        defaultValues: { kind: 'ASSEMBLEIA' },
    });
    const kind = watch('kind');
    const isOperation = kind === 'ASSEMBLEIA' || kind === 'CONGRESSO' || kind === 'ATUACAO_BRIGADA';
    const isMeeting = kind === 'REUNIAO';

    const openCreate = () => {
        reset({ kind: 'ASSEMBLEIA', title: '', location: '', startDate: '', endDate: '', estimatedAudienceCount: '', notes: '', agenda: '' });
        setModalOpen(true);
    };

    const createMutation = useMutation({
        mutationFn: (input: CreateEventInput) => eventsApi.create(input),
        onSuccess: (event) => {
            toast.success('Evento criado com sucesso.');
            queryClient.invalidateQueries({ queryKey: ['events'] });
            setModalOpen(false);
            navigate(`/events/${event.id}`);
        },
        onError: (error: any) => toast.error(error?.response?.data?.message || 'Não foi possível criar o evento.'),
    });

    const onSubmit = (formData: FormData) => {
        createMutation.mutate({
            kind: formData.kind,
            title: formData.title,
            location: formData.location || undefined,
            startDate: formData.startDate,
            endDate: formData.endDate || undefined,
            estimatedAudienceCount: formData.estimatedAudienceCount ? Number(formData.estimatedAudienceCount) : undefined,
            notes: formData.notes || undefined,
            agenda: formData.agenda || undefined,
        });
    };

    const events = data?.data ?? [];

    return (
        <PageLayout
            title="Eventos"
            subtitle="Assembleias, congressos e atuações de brigada"
            icon={<CalendarClock size={16} />}
            actions={
                <Button onClick={openCreate}>
                    <Plus size={16} /> Novo evento
                </Button>
            }
        >
            <TableWrapper>
                <Table>
                    <Thead>
                        <tr>
                            <Th>Evento</Th>
                            <Th>Tipo</Th>
                            <Th>Data</Th>
                            <Th>Local</Th>
                            <Th>Status</Th>
                            <Th></Th>
                        </tr>
                    </Thead>
                    <tbody>
                        {events.map((event) => (
                            <Tr key={event.id} onClick={() => navigate(`/events/${event.id}`)} style={{ cursor: 'pointer' }}>
                                <Td>{event.title}</Td>
                                <Td><Badge $tone="info">{KIND_LABEL[event.kind]}</Badge></Td>
                                <Td>{format(new Date(event.startDate), 'dd/MM/yyyy')}</Td>
                                <Td>{event.location || '—'}</Td>
                                <Td><Badge $tone={STATUS_TONE[event.status]}>{STATUS_LABEL[event.status]}</Badge></Td>
                                <Td>
                                    <Button $variant="ghost" onClick={(e) => { e.stopPropagation(); navigate(`/events/${event.id}`); }}>
                                        Abrir
                                    </Button>
                                </Td>
                            </Tr>
                        ))}
                    </tbody>
                </Table>
                {!isLoading && events.length === 0 && <EmptyState>Nenhum evento cadastrado ainda.</EmptyState>}
            </TableWrapper>

            <Modal open={modalOpen} onOpenChange={setModalOpen} title="Novo evento" width="560px">
                <Form onSubmit={handleSubmit(onSubmit)}>
                    <Field>
                        <Label htmlFor="kind">Tipo de evento</Label>
                        <Select id="kind" {...register('kind')}>
                            <option value="ASSEMBLEIA">Assembleia</option>
                            <option value="CONGRESSO">Congresso</option>
                            <option value="ATUACAO_BRIGADA">Atuação de brigada</option>
                            <option value="REUNIAO">Reunião (gera link do Google Meet automaticamente)</option>
                        </Select>
                    </Field>

                    <Field>
                        <Label htmlFor="title">Título</Label>
                        <Input id="title" {...register('title')} />
                        {errors.title && <ErrorText>{errors.title.message}</ErrorText>}
                    </Field>

                    <FieldRow>
                        <Field>
                            <Label htmlFor="startDate">Data/hora de início</Label>
                            <Input id="startDate" type="datetime-local" {...register('startDate')} />
                            {errors.startDate && <ErrorText>{errors.startDate.message}</ErrorText>}
                        </Field>
                        <Field>
                            <Label htmlFor="endDate">Data/hora de término (opcional)</Label>
                            <Input id="endDate" type="datetime-local" {...register('endDate')} />
                        </Field>
                    </FieldRow>

                    <Field>
                        <Label htmlFor="location">Local</Label>
                        <Input id="location" {...register('location')} />
                    </Field>

                    {isOperation && (
                        <>
                            <Field>
                                <Label htmlFor="estimatedAudienceCount">Estimativa de público (opcional)</Label>
                                <Input id="estimatedAudienceCount" type="number" min={0} {...register('estimatedAudienceCount')} />
                            </Field>
                            <Field>
                                <Label htmlFor="notes">Observações</Label>
                                <Textarea id="notes" {...register('notes')} />
                            </Field>
                        </>
                    )}

                    {isMeeting && (
                        <Field>
                            <Label htmlFor="agenda">Pauta</Label>
                            <Textarea id="agenda" {...register('agenda')} />
                        </Field>
                    )}

                    <FormActions>
                        <Button type="button" $variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
                        <Button type="submit" disabled={createMutation.isPending}>
                            {createMutation.isPending ? 'Salvando...' : 'Criar evento'}
                        </Button>
                    </FormActions>
                </Form>
            </Modal>
        </PageLayout>
    );
}
