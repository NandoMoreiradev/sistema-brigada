// frontend/src/pages/course-detail/SessionsTab.tsx
//
// Agenda da turma. Criar/editar/excluir aula exige `courses:manage` (backend); instrutor da
// turma só lança chamada e diário — por isso os botões de gestão não aparecem para ele.

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, ClipboardCheck } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Field, Label, Input, Select, ErrorText, Form, FormActions, FieldRow } from '@/components/ui/FormField';
import { Table, TableWrapper, Thead, Tr, Th, Td, EmptyState, Badge } from '@/components/ui/Table';
import { roomsApi, classSessionsApi } from '@/services/courses';
import { toast } from '@/utils/toast';
import { apiErrorMessage } from '@/utils/apiError';
import { formatDateWithWeekday, sessionTiming, toDateOnly } from '@/utils/courseDates';
import { ScrollX, Toolbar, RowActions, Muted, MiniProgress } from './styles';
import type { ClassSession } from '@/types';

const sessionSchema = z
    .object({
        date: z.string().min(1, 'Informe a data'),
        startTime: z.string().min(1, 'Informe o horário de início'),
        endTime: z.string().min(1, 'Informe o horário de término'),
        roomId: z.string().optional(),
    })
    .refine((data) => data.endTime > data.startTime, { path: ['endTime'], message: 'O término deve ser depois do início' });
type SessionFormData = z.infer<typeof sessionSchema>;

interface SessionsTabProps {
    courseId: string;
    sessions: ClassSession[];
    enrollmentsCount: number;
    canManage: boolean;
    onOpenAttendance: (sessionId: string) => void;
}

export function SessionsTab({ courseId, sessions, enrollmentsCount, canManage, onOpenAttendance }: SessionsTabProps) {
    const queryClient = useQueryClient();
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<ClassSession | null>(null);

    // Salas só são necessárias no formulário de aula, que é de quem gerencia a turma.
    const { data: rooms } = useQuery({ queryKey: ['rooms'], queryFn: () => roomsApi.list(), enabled: canManage });

    const { register, handleSubmit, reset, formState: { errors } } = useForm<SessionFormData>({ resolver: zodResolver(sessionSchema) });

    const openCreate = () => {
        // Sugere a data e o horário da última aula: turmas costumam repetir o mesmo horário.
        const last = sessions[sessions.length - 1];
        reset({ date: '', startTime: last?.startTime ?? '', endTime: last?.endTime ?? '', roomId: last?.roomId ?? '' });
        setEditing(null);
        setModalOpen(true);
    };

    const openEdit = (session: ClassSession) => {
        reset({ date: toDateOnly(session.date), startTime: session.startTime, endTime: session.endTime, roomId: session.roomId ?? '' });
        setEditing(session);
        setModalOpen(true);
    };

    const invalidate = () => queryClient.invalidateQueries({ queryKey: ['courses', courseId, 'sessions'] });

    const saveMutation = useMutation({
        mutationFn: (input: SessionFormData) => {
            const payload = { date: input.date, startTime: input.startTime, endTime: input.endTime, roomId: input.roomId || undefined };
            return editing ? classSessionsApi.update(courseId, editing.id, payload) : classSessionsApi.create(courseId, payload);
        },
        onSuccess: () => {
            toast.success(editing ? 'Aula atualizada.' : 'Aula agendada com sucesso.');
            invalidate();
            setModalOpen(false);
        },
        onError: (error: unknown) => toast.error(apiErrorMessage(error, 'Não foi possível salvar a aula.')),
    });

    const removeMutation = useMutation({
        mutationFn: (sessionId: string) => classSessionsApi.remove(courseId, sessionId),
        onSuccess: () => {
            toast.success('Aula removida.');
            invalidate();
        },
        onError: (error: unknown) => toast.error(apiErrorMessage(error, 'Não foi possível remover a aula.')),
    });

    const handleRemove = (session: ClassSession) => {
        const hasRecords = (session._count?.attendances ?? 0) > 0 || Boolean(session.classLog);
        const warning = hasRecords ? '\n\nATENÇÃO: as presenças e o diário já lançados nesta aula serão apagados.' : '';
        if (window.confirm(`Remover a aula de ${formatDateWithWeekday(session.date)}?${warning}`)) {
            removeMutation.mutate(session.id);
        }
    };

    // A primeira aula de hoje em diante recebe o destaque "Próxima".
    const nextSessionId = sessions.find((s) => sessionTiming(s.date) !== 'past')?.id;

    return (
        <>
            {canManage && (
                <Toolbar>
                    <Muted>{sessions.length} {sessions.length === 1 ? 'aula agendada' : 'aulas agendadas'}</Muted>
                    <Button onClick={openCreate}>
                        <Plus size={16} /> Nova aula
                    </Button>
                </Toolbar>
            )}

            <TableWrapper>
                <ScrollX>
                    <Table>
                        <Thead>
                            <tr>
                                <Th>Data</Th>
                                <Th>Horário</Th>
                                <Th>Sala</Th>
                                <Th>Chamada</Th>
                                <Th>Diário</Th>
                                <Th></Th>
                            </tr>
                        </Thead>
                        <tbody>
                            {sessions.map((session) => {
                                const timing = sessionTiming(session.date);
                                const launched = session._count?.attendances ?? 0;
                                const percent = enrollmentsCount ? (launched / enrollmentsCount) * 100 : 0;
                                return (
                                    <Tr key={session.id} style={timing === 'past' ? { opacity: 0.85 } : undefined}>
                                        <Td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                                <strong style={{ textTransform: 'capitalize' }}>{formatDateWithWeekday(session.date)}</strong>
                                                {timing === 'today' && <Badge $tone="success">Hoje</Badge>}
                                                {timing !== 'today' && session.id === nextSessionId && <Badge $tone="info">Próxima</Badge>}
                                            </div>
                                        </Td>
                                        <Td>{session.startTime} — {session.endTime}</Td>
                                        <Td>{session.room?.name || '—'}</Td>
                                        <Td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <MiniProgress $percent={percent} />
                                                <Muted>{launched} / {enrollmentsCount}</Muted>
                                            </div>
                                        </Td>
                                        <Td>{session.classLog ? <Badge $tone="success">Lançado</Badge> : <Badge>Pendente</Badge>}</Td>
                                        <Td>
                                            <RowActions>
                                                <Button
                                                    $variant={timing === 'past' || timing === 'today' ? 'primary' : 'secondary'}
                                                    onClick={() => onOpenAttendance(session.id)}
                                                >
                                                    <ClipboardCheck size={14} /> Chamada e diário
                                                </Button>
                                                {canManage && (
                                                    <>
                                                        <Button $variant="ghost" onClick={() => openEdit(session)} aria-label="Editar aula" title="Editar aula">
                                                            <Pencil size={14} />
                                                        </Button>
                                                        <Button
                                                            $variant="ghost"
                                                            onClick={() => handleRemove(session)}
                                                            disabled={removeMutation.isPending}
                                                            aria-label="Remover aula"
                                                            title="Remover aula"
                                                        >
                                                            <Trash2 size={14} />
                                                        </Button>
                                                    </>
                                                )}
                                            </RowActions>
                                        </Td>
                                    </Tr>
                                );
                            })}
                        </tbody>
                    </Table>
                </ScrollX>
                {sessions.length === 0 && (
                    <EmptyState>{canManage ? 'Nenhuma aula agendada ainda. Use “Nova aula” para montar o calendário da turma.' : 'Nenhuma aula agendada ainda.'}</EmptyState>
                )}
            </TableWrapper>

            <Modal open={modalOpen} onOpenChange={setModalOpen} title={editing ? 'Editar aula' : 'Nova aula'}>
                <Form onSubmit={handleSubmit((data) => saveMutation.mutate(data))}>
                    <Field>
                        <Label htmlFor="sessionDate">Data</Label>
                        <Input id="sessionDate" type="date" {...register('date')} />
                        {errors.date && <ErrorText>{errors.date.message}</ErrorText>}
                    </Field>
                    <FieldRow>
                        <Field>
                            <Label htmlFor="sessionStart">Início</Label>
                            <Input id="sessionStart" type="time" {...register('startTime')} />
                            {errors.startTime && <ErrorText>{errors.startTime.message}</ErrorText>}
                        </Field>
                        <Field>
                            <Label htmlFor="sessionEnd">Término</Label>
                            <Input id="sessionEnd" type="time" {...register('endTime')} />
                            {errors.endTime && <ErrorText>{errors.endTime.message}</ErrorText>}
                        </Field>
                    </FieldRow>
                    <Field>
                        <Label htmlFor="sessionRoom">Sala (opcional)</Label>
                        <Select id="sessionRoom" {...register('roomId')}>
                            <option value="">Sem sala definida</option>
                            {(rooms ?? []).map((room) => (
                                <option key={room.id} value={room.id}>{room.name}</option>
                            ))}
                        </Select>
                    </Field>
                    <FormActions>
                        <Button type="button" $variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
                        <Button type="submit" disabled={saveMutation.isPending}>
                            {saveMutation.isPending ? 'Salvando...' : editing ? 'Salvar alterações' : 'Agendar aula'}
                        </Button>
                    </FormActions>
                </Form>
            </Modal>
        </>
    );
}
