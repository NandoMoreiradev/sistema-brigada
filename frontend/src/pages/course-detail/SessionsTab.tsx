// frontend/src/pages/course-detail/SessionsTab.tsx
//
// Agenda da turma. Criar/editar/excluir aula exige `courses:manage` (backend); instrutor da
// turma só lança chamada e diário — por isso os botões de gestão não aparecem para ele.

import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, ClipboardCheck } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Field, Label, Input, Textarea, ErrorText, HelpText, Form, FormActions, FieldRow } from '@/components/ui/FormField';
import { Table, TableWrapper, Thead, Tr, Th, Td, EmptyState, Badge } from '@/components/ui/Table';
import { classSessionsApi } from '@/services/courses';
import { toast } from '@/utils/toast';
import { apiErrorMessage } from '@/utils/apiError';
import { formatDateWithWeekday, sessionTiming, toDateOnly } from '@/utils/courseDates';
import { RoomSelect } from './RoomSelect';
import { ScrollX, Toolbar, ToolbarGroup, FilterChip, RowActions, Muted, MiniProgress } from './styles';
import type { ClassSession } from '@/types';

const sessionSchema = z
    .object({
        date: z.string().min(1, 'Informe a data'),
        startTime: z.string().min(1, 'Informe o horário de início'),
        endTime: z.string().min(1, 'Informe o horário de término'),
        roomId: z.string().optional(),
        topic: z.string().max(200, 'No máximo 200 caracteres').optional(),
    })
    .refine((data) => data.endTime > data.startTime, { path: ['endTime'], message: 'O término deve ser depois do início' });
type SessionFormData = z.infer<typeof sessionSchema>;

interface SessionsTabProps {
    courseId: string;
    sessions: ClassSession[];
    enrollmentsCount: number;
    canManage: boolean;
    /** Instrutores da turma: são as únicas pessoas que podem ser escaladas numa aula. */
    courseInstructors: { userId: string; user: { name: string } }[];
    currentUserId?: string;
    /** Sala padrão da turma: vem pré-selecionada numa aula nova. */
    defaultRoomId?: string | null;
    vacancies?: number | null;
    onOpenAttendance: (sessionId: string) => void;
}

export function SessionsTab({ courseId, sessions, enrollmentsCount, canManage, courseInstructors, currentUserId, defaultRoomId, vacancies, onOpenAttendance }: SessionsTabProps) {
    const queryClient = useQueryClient();
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<ClassSession | null>(null);
    const [selectedInstructorIds, setSelectedInstructorIds] = useState<string[]>([]);
    const [onlyMine, setOnlyMine] = useState(false);

    const isInstructor = courseInstructors.some((i) => i.userId === currentUserId);
    const isAssignedToMe = (session: ClassSession) => session.instructors.some((i) => i.userId === currentUserId);
    /** Espelha o backend: admin, ou instrutor da turma — e, se a aula tem escala, só um dos escalados. */
    const canRecord = (session: ClassSession) => canManage || (isInstructor && (session.instructors.length === 0 || isAssignedToMe(session)));
    const myCount = sessions.filter(isAssignedToMe).length;

    const { register, handleSubmit, reset, control, formState: { errors } } = useForm<SessionFormData>({ resolver: zodResolver(sessionSchema) });

    const openCreate = () => {
        // Sugere o horário da última aula (turmas costumam repetir o mesmo horário) e a sala padrão
        // da turma — ou, sem ela, a sala da última aula.
        const last = sessions[sessions.length - 1];
        reset({ date: '', startTime: last?.startTime ?? '', endTime: last?.endTime ?? '', roomId: defaultRoomId || last?.roomId || '', topic: '' });
        setSelectedInstructorIds([]);
        setEditing(null);
        setModalOpen(true);
    };

    const openEdit = (session: ClassSession) => {
        reset({ date: toDateOnly(session.date), startTime: session.startTime, endTime: session.endTime, roomId: session.roomId ?? '', topic: session.topic ?? '' });
        setSelectedInstructorIds(session.instructors.map((i) => i.userId));
        setEditing(session);
        setModalOpen(true);
    };

    const invalidate = () => queryClient.invalidateQueries({ queryKey: ['courses', courseId, 'sessions'] });

    const saveMutation = useMutation({
        mutationFn: (input: SessionFormData) => {
            const payload = {
                date: input.date,
                startTime: input.startTime,
                endTime: input.endTime,
                // Na edição, `null` tira a sala; na criação, sem sala é só não mandar.
                roomId: input.roomId || (editing ? null : undefined),
                topic: input.topic?.trim() ?? '',
                instructorIds: selectedInstructorIds,
            };
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
        const hasRecords = (session._count?.attendances ?? 0) > 0 || (session._count?.classLogs ?? 0) > 0;
        const warning = hasRecords ? '\n\nATENÇÃO: as presenças e o diário já lançados nesta aula serão apagados.' : '';
        if (window.confirm(`Remover a aula de ${formatDateWithWeekday(session.date)}?${warning}`)) {
            removeMutation.mutate(session.id);
        }
    };

    const visibleSessions = onlyMine ? sessions.filter(isAssignedToMe) : sessions;
    // A primeira aula de hoje em diante recebe o destaque "Próxima".
    const nextSessionId = sessions.find((s) => sessionTiming(s.date) !== 'past')?.id;

    return (
        <>
            {(canManage || myCount > 0) && (
                <Toolbar>
                    <ToolbarGroup>
                        <Muted>{sessions.length} {sessions.length === 1 ? 'aula agendada' : 'aulas agendadas'}</Muted>
                        {myCount > 0 && (
                            <FilterChip type="button" $active={onlyMine} onClick={() => setOnlyMine((value) => !value)}>
                                Só as minhas aulas ({myCount})
                            </FilterChip>
                        )}
                    </ToolbarGroup>
                    {canManage && (
                        <Button onClick={openCreate}>
                            <Plus size={16} /> Nova aula
                        </Button>
                    )}
                </Toolbar>
            )}

            <TableWrapper>
                <ScrollX>
                    <Table>
                        <Thead>
                            <tr>
                                <Th>Data</Th>
                                <Th>Horário</Th>
                                <Th>Assunto / professor</Th>
                                <Th>Sala</Th>
                                <Th>Chamada</Th>
                                <Th>Diário</Th>
                                <Th></Th>
                            </tr>
                        </Thead>
                        <tbody>
                            {visibleSessions.map((session) => {
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
                                        <Td style={{ whiteSpace: 'nowrap' }}>{session.startTime} — {session.endTime}</Td>
                                        <Td>
                                            {session.topic && <div style={{ fontWeight: 600 }}>{session.topic}</div>}
                                            <Muted>
                                                {session.instructors.length > 0
                                                    ? session.instructors.map((i) => i.user.name).join(', ')
                                                    : 'Qualquer instrutor da turma'}
                                            </Muted>
                                        </Td>
                                        <Td>{session.room?.name || '—'}</Td>
                                        <Td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <MiniProgress $percent={percent} />
                                                <Muted style={{ whiteSpace: 'nowrap' }}>{launched} / {enrollmentsCount}</Muted>
                                            </div>
                                        </Td>
                                        <Td>{(session._count?.classLogs ?? 0) > 0 ? <Badge $tone="success">Lançado</Badge> : <Badge>Pendente</Badge>}</Td>
                                        <Td>
                                            <RowActions>
                                                {canRecord(session) && (
                                                    <Button
                                                        $variant={timing === 'past' || timing === 'today' ? 'primary' : 'secondary'}
                                                        onClick={() => onOpenAttendance(session.id)}
                                                    >
                                                        <ClipboardCheck size={14} /> Chamada e diário
                                                    </Button>
                                                )}
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
                {visibleSessions.length === 0 && (
                    <EmptyState>{onlyMine ? 'Nenhuma aula escalada para você.' : canManage ? 'Nenhuma aula agendada ainda. Use “Nova aula” para montar o calendário da turma.' : 'Nenhuma aula agendada ainda.'}</EmptyState>
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
                        <Controller
                            control={control}
                            name="roomId"
                            render={({ field }) => (
                                <RoomSelect id="sessionRoom" value={field.value ?? ''} onChange={field.onChange} emptyLabel="Sem sala definida" vacancies={vacancies} />
                            )}
                        />
                    </Field>
                    <Field>
                        <Label htmlFor="sessionTopic">Assunto da aula (opcional)</Label>
                        <Textarea id="sessionTopic" rows={2} placeholder="ex: Primeiros socorros — RCP e uso do DEA" {...register('topic')} />
                        {errors.topic && <ErrorText>{errors.topic.message}</ErrorText>}
                    </Field>
                    <Field>
                        <Label>Professor(es) desta aula</Label>
                        {courseInstructors.length === 0 ? (
                            <HelpText>Adicione instrutores à turma (Editar turma) para poder escalá-los por aula.</HelpText>
                        ) : (
                            <>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem 1rem' }}>
                                    {courseInstructors.map((instructor) => (
                                        <label key={instructor.userId} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8125rem' }}>
                                            <input
                                                type="checkbox"
                                                checked={selectedInstructorIds.includes(instructor.userId)}
                                                onChange={(e) =>
                                                    setSelectedInstructorIds((current) =>
                                                        e.target.checked ? [...current, instructor.userId] : current.filter((id) => id !== instructor.userId),
                                                    )
                                                }
                                            />
                                            {instructor.user.name}
                                        </label>
                                    ))}
                                </div>
                                <HelpText>Sem ninguém marcado, qualquer instrutor da turma pode lançar chamada e diário.</HelpText>
                            </>
                        )}
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
