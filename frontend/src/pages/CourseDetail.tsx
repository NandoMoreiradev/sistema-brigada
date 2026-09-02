// frontend/src/pages/CourseDetail.tsx
//
// Detalhe de uma turma: aulas (agenda + diário + chamada de presença) e
// matrículas. A emissão automática de certificado por critério de presença
// (decisão 16/17 do docs/decisoes.md) fica para o módulo de certificados —
// aqui só criamos a base de dados que ele vai consumir (Attendance/Enrollment).

import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import * as Tabs from '@radix-ui/react-tabs';
import styled from 'styled-components';
import { ArrowLeft, Plus, ClipboardList, PlayCircle, CheckCircle2, Circle, Trash2 } from 'lucide-react';
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
import { coursesApi, roomsApi, classSessionsApi, enrollmentsApi, courseModulesApi, courseLessonsApi } from '@/services/courses';
import { peopleApi } from '@/services/people';
import { toast } from '@/utils/toast';
import type { AttendanceStatus, EnrollmentStatus } from '@/types';

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

    &:hover {
        color: ${({ theme }) => theme.colors.textDark};
    }
`;

const InfoRow = styled.div`
    display: flex;
    gap: 1.5rem;
    flex-wrap: wrap;
    font-size: 0.8125rem;
    color: ${({ theme }) => theme.colors.textMedium};
    margin-bottom: 1rem;

    strong {
        color: ${({ theme }) => theme.colors.textDark};
    }
`;

const sessionSchema = z.object({
    date: z.string().min(1, 'Informe a data'),
    startTime: z.string().min(1, 'Informe o horário de início'),
    endTime: z.string().min(1, 'Informe o horário de término'),
    roomId: z.string().optional(),
});
type SessionFormData = z.infer<typeof sessionSchema>;

const ATTENDANCE_LABEL: Record<AttendanceStatus, string> = {
    PRESENT: 'Presente',
    ABSENT: 'Ausente',
    JUSTIFIED_ABSENT: 'Falta justificada',
};

const ENROLLMENT_LABEL: Record<EnrollmentStatus, string> = {
    ACTIVE: 'Ativa',
    COMPLETED: 'Concluída',
    DROPPED: 'Cancelada',
};

const ENROLLMENT_TONE: Record<EnrollmentStatus, 'success' | 'info' | 'danger'> = {
    ACTIVE: 'info',
    COMPLETED: 'success',
    DROPPED: 'danger',
};

export default function CourseDetail() {
    const { id } = useParams<{ id: string }>();
    const courseId = id!;
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const [sessionModalOpen, setSessionModalOpen] = useState(false);
    const [enrollModalOpen, setEnrollModalOpen] = useState(false);
    const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

    const { data: course } = useQuery({ queryKey: ['courses', courseId], queryFn: () => coursesApi.get(courseId) });
    const { data: sessions } = useQuery({ queryKey: ['courses', courseId, 'sessions'], queryFn: () => classSessionsApi.list(courseId) });
    const { data: enrollments } = useQuery({ queryKey: ['courses', courseId, 'enrollments'], queryFn: () => enrollmentsApi.list(courseId) });
    const { data: rooms } = useQuery({ queryKey: ['rooms'], queryFn: () => roomsApi.list() });
    const { data: peopleData } = useQuery({ queryKey: ['people', { hasStudentProfile: true }], queryFn: () => peopleApi.list({ hasStudentProfile: true }) });

    const invalidateCourse = () => {
        queryClient.invalidateQueries({ queryKey: ['courses', courseId] });
    };

    const { register: registerSession, handleSubmit: handleSubmitSession, reset: resetSession, formState: { errors: sessionErrors } } = useForm<SessionFormData>({
        resolver: zodResolver(sessionSchema),
    });

    const createSessionMutation = useMutation({
        mutationFn: (input: SessionFormData) =>
            classSessionsApi.create(courseId, { date: input.date, startTime: input.startTime, endTime: input.endTime, roomId: input.roomId || undefined }),
        onSuccess: () => {
            toast.success('Aula agendada com sucesso.');
            queryClient.invalidateQueries({ queryKey: ['courses', courseId, 'sessions'] });
            setSessionModalOpen(false);
        },
        onError: (error: any) => toast.error(error?.response?.data?.message || 'Não foi possível agendar a aula.'),
    });

    const [enrollUserId, setEnrollUserId] = useState('');
    const enrollMutation = useMutation({
        mutationFn: (userId: string) => enrollmentsApi.enroll(courseId, userId),
        onSuccess: () => {
            toast.success('Aluno matriculado com sucesso.');
            queryClient.invalidateQueries({ queryKey: ['courses', courseId, 'enrollments'] });
            invalidateCourse();
            setEnrollModalOpen(false);
            setEnrollUserId('');
        },
        onError: (error: any) => toast.error(error?.response?.data?.message || 'Não foi possível matricular o aluno.'),
    });

    const updateEnrollmentStatusMutation = useMutation({
        mutationFn: ({ enrollmentId, status }: { enrollmentId: string; status: string }) =>
            enrollmentsApi.updateStatus(courseId, enrollmentId, status),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['courses', courseId, 'enrollments'] });
            toast.success('Status da matrícula atualizado.');
        },
        onError: (error: any) => toast.error(error?.response?.data?.message || 'Não foi possível atualizar a matrícula.'),
    });

    if (!course) {
        return (
            <PageLayout title="Turma" icon={<ClipboardList size={16} />}>
                <EmptyState>Carregando...</EmptyState>
            </PageLayout>
        );
    }

    const enrolledUserIds = new Set((enrollments ?? []).map((e) => e.studentProfile.user.id));
    const availableStudents = (peopleData?.data ?? []).filter((p) => !enrolledUserIds.has(p.id));
    const activeSession = (sessions ?? []).find((s) => s.id === activeSessionId) ?? null;

    return (
        <PageLayout
            title={course.event.title}
            subtitle={course.category || undefined}
            icon={<ClipboardList size={16} />}
        >
            <BackLink onClick={() => navigate('/courses')}>
                <ArrowLeft size={14} /> Voltar para turmas
            </BackLink>

            <InfoRow>
                <span><strong>Início:</strong> {format(new Date(course.event.startDate), 'dd/MM/yyyy')}</span>
                {course.event.location && <span><strong>Local:</strong> {course.event.location}</span>}
                <span><strong>Instrutores:</strong> {course.instructors.map((i) => i.user.name).join(', ') || '—'}</span>
                <span><strong>Matriculados:</strong> {course._count.enrollments}{course.vacancies ? ` / ${course.vacancies}` : ''}</span>
                <span><strong>Presença mínima p/ certificado:</strong> {course.minAttendancePercent}%</span>
            </InfoRow>

            <Tabs.Root defaultValue="sessions">
                <TabsList>
                    <TabsTrigger value="sessions">Agenda</TabsTrigger>
                    <TabsTrigger value="lessons">Vídeo-aulas</TabsTrigger>
                    <TabsTrigger value="enrollments">Matrículas</TabsTrigger>
                </TabsList>

                <Tabs.Content value="sessions">
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.75rem' }}>
                        <Button onClick={() => { resetSession({ date: '', startTime: '', endTime: '', roomId: '' }); setSessionModalOpen(true); }}>
                            <Plus size={16} /> Nova aula
                        </Button>
                    </div>
                    <TableWrapper>
                        <Table>
                            <Thead>
                                <tr>
                                    <Th>Data</Th>
                                    <Th>Horário</Th>
                                    <Th>Sala</Th>
                                    <Th>Presenças lançadas</Th>
                                    <Th>Diário</Th>
                                    <Th></Th>
                                </tr>
                            </Thead>
                            <tbody>
                                {(sessions ?? []).map((session) => (
                                    <Tr key={session.id}>
                                        <Td>{format(new Date(session.date), 'dd/MM/yyyy')}</Td>
                                        <Td>{session.startTime} — {session.endTime}</Td>
                                        <Td>{session.room?.name || '—'}</Td>
                                        <Td>{session._count?.attendances ?? 0} / {enrollments?.length ?? 0}</Td>
                                        <Td>{session.classLog ? <Badge $tone="success">Lançado</Badge> : <Badge>Pendente</Badge>}</Td>
                                        <Td>
                                            <Button $variant="ghost" onClick={() => setActiveSessionId(session.id)}>
                                                Chamada / diário
                                            </Button>
                                        </Td>
                                    </Tr>
                                ))}
                            </tbody>
                        </Table>
                        {(sessions ?? []).length === 0 && <EmptyState>Nenhuma aula agendada ainda.</EmptyState>}
                    </TableWrapper>
                </Tabs.Content>

                <Tabs.Content value="lessons">
                    <LessonsTab courseId={courseId} />
                </Tabs.Content>

                <Tabs.Content value="enrollments">
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.75rem' }}>
                        <Button onClick={() => setEnrollModalOpen(true)}>
                            <Plus size={16} /> Matricular aluno
                        </Button>
                    </div>
                    <TableWrapper>
                        <Table>
                            <Thead>
                                <tr>
                                    <Th>Aluno</Th>
                                    <Th>E-mail</Th>
                                    <Th>Status</Th>
                                    <Th>Alterar status</Th>
                                </tr>
                            </Thead>
                            <tbody>
                                {(enrollments ?? []).map((enrollment) => (
                                    <Tr key={enrollment.id}>
                                        <Td>{enrollment.studentProfile.user.name}</Td>
                                        <Td>{enrollment.studentProfile.user.email}</Td>
                                        <Td><Badge $tone={ENROLLMENT_TONE[enrollment.status]}>{ENROLLMENT_LABEL[enrollment.status]}</Badge></Td>
                                        <Td>
                                            <Select
                                                value={enrollment.status}
                                                onChange={(e) => updateEnrollmentStatusMutation.mutate({ enrollmentId: enrollment.id, status: e.target.value })}
                                            >
                                                <option value="ACTIVE">Ativa</option>
                                                <option value="COMPLETED">Concluída</option>
                                                <option value="DROPPED">Cancelada</option>
                                            </Select>
                                        </Td>
                                    </Tr>
                                ))}
                            </tbody>
                        </Table>
                        {(enrollments ?? []).length === 0 && <EmptyState>Nenhum aluno matriculado ainda.</EmptyState>}
                    </TableWrapper>
                </Tabs.Content>
            </Tabs.Root>

            {/* Nova aula */}
            <Modal open={sessionModalOpen} onOpenChange={setSessionModalOpen} title="Nova aula">
                <Form onSubmit={handleSubmitSession((data) => createSessionMutation.mutate(data))}>
                    <Field>
                        <Label htmlFor="date">Data</Label>
                        <Input id="date" type="date" {...registerSession('date')} />
                        {sessionErrors.date && <ErrorText>{sessionErrors.date.message}</ErrorText>}
                    </Field>
                    <FieldRow>
                        <Field>
                            <Label htmlFor="startTime">Início</Label>
                            <Input id="startTime" type="time" {...registerSession('startTime')} />
                            {sessionErrors.startTime && <ErrorText>{sessionErrors.startTime.message}</ErrorText>}
                        </Field>
                        <Field>
                            <Label htmlFor="endTime">Término</Label>
                            <Input id="endTime" type="time" {...registerSession('endTime')} />
                            {sessionErrors.endTime && <ErrorText>{sessionErrors.endTime.message}</ErrorText>}
                        </Field>
                    </FieldRow>
                    <Field>
                        <Label htmlFor="roomId">Sala (opcional)</Label>
                        <Select id="roomId" {...registerSession('roomId')}>
                            <option value="">Sem sala definida</option>
                            {(rooms ?? []).map((room) => (
                                <option key={room.id} value={room.id}>{room.name}</option>
                            ))}
                        </Select>
                    </Field>
                    <FormActions>
                        <Button type="button" $variant="secondary" onClick={() => setSessionModalOpen(false)}>Cancelar</Button>
                        <Button type="submit" disabled={createSessionMutation.isPending}>
                            {createSessionMutation.isPending ? 'Salvando...' : 'Agendar aula'}
                        </Button>
                    </FormActions>
                </Form>
            </Modal>

            {/* Matricular aluno */}
            <Modal open={enrollModalOpen} onOpenChange={setEnrollModalOpen} title="Matricular aluno">
                <Form onSubmit={(e) => { e.preventDefault(); if (enrollUserId) enrollMutation.mutate(enrollUserId); }}>
                    <Field>
                        <Label htmlFor="student">Aluno</Label>
                        <Select id="student" value={enrollUserId} onChange={(e) => setEnrollUserId(e.target.value)}>
                            <option value="">Selecione um aluno</option>
                            {availableStudents.map((student) => (
                                <option key={student.id} value={student.id}>{student.name} — {student.email}</option>
                            ))}
                        </Select>
                        {availableStudents.length === 0 && (
                            <ErrorText>Todos os alunos cadastrados já estão matriculados, ou nenhum aluno foi cadastrado ainda.</ErrorText>
                        )}
                    </Field>
                    <FormActions>
                        <Button type="button" $variant="secondary" onClick={() => setEnrollModalOpen(false)}>Cancelar</Button>
                        <Button type="submit" disabled={!enrollUserId || enrollMutation.isPending}>
                            {enrollMutation.isPending ? 'Matriculando...' : 'Matricular'}
                        </Button>
                    </FormActions>
                </Form>
            </Modal>

            {/* Chamada de presença + diário de aula */}
            {activeSession && (
                <AttendanceModal
                    courseId={courseId}
                    session={activeSession}
                    enrollmentsCount={enrollments?.length ?? 0}
                    onClose={() => setActiveSessionId(null)}
                />
            )}
        </PageLayout>
    );
}

const ModuleCard = styled.div`
    background: ${({ theme }) => theme.colors.white};
    border: 1px solid ${({ theme }) => theme.colors.borderLight};
    border-radius: ${({ theme }) => theme.radii.md};
    padding: 1rem 1.25rem;
    margin-bottom: 0.875rem;
`;

const ModuleHeader = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.5rem;

    h3 {
        margin: 0;
        font-size: 0.9375rem;
        font-weight: 700;
        color: ${({ theme }) => theme.colors.textDark};
    }
`;

const LessonRow = styled.div`
    display: flex;
    align-items: center;
    gap: 0.65rem;
    padding: 0.5rem 0;
    border-top: 1px solid ${({ theme }) => theme.colors.borderLight};
    font-size: 0.8125rem;

    &:first-of-type { border-top: none; }
`;

const LessonTitle = styled.div`
    flex: 1;
    display: flex;
    flex-direction: column;

    strong { color: ${({ theme }) => theme.colors.textDark}; }
    span { font-size: 0.7rem; color: ${({ theme }) => theme.colors.textMuted}; }
`;

/**
 * Módulos + aulas em vídeo de uma turma (decisão de reaproveitamento em
 * docs/decisoes.md: TrainingModule/Lesson/Progress do maskotCrmEdu, agora
 * escopado por Course). Vídeo em si é só um link (`videoUrl`) por enquanto —
 * upload direto via presigned URL fica para quando existir uma UI de upload
 * de arquivo grande; o instrutor cola o link do vídeo já hospedado.
 */
function LessonsTab({ courseId }: { courseId: string }) {
    const [moduleModalOpen, setModuleModalOpen] = useState(false);
    const [lessonModalModuleId, setLessonModalModuleId] = useState<string | null>(null);
    const queryClient = useQueryClient();

    const { data: modules } = useQuery({ queryKey: ['courses', courseId, 'modules'], queryFn: () => courseModulesApi.list(courseId) });

    const { register: registerModule, handleSubmit: handleSubmitModule, reset: resetModule } = useForm<{ title: string }>();
    const { register: registerLesson, handleSubmit: handleSubmitLesson, reset: resetLesson } = useForm<{ title: string; videoUrl: string; duration: string }>();

    const invalidateModules = () => queryClient.invalidateQueries({ queryKey: ['courses', courseId, 'modules'] });

    const createModuleMutation = useMutation({
        mutationFn: (title: string) => courseModulesApi.create(courseId, { title }),
        onSuccess: () => { toast.success('Módulo criado.'); invalidateModules(); setModuleModalOpen(false); },
        onError: (error: any) => toast.error(error?.response?.data?.message || 'Não foi possível criar o módulo.'),
    });

    const removeModuleMutation = useMutation({
        mutationFn: (moduleId: string) => courseModulesApi.remove(courseId, moduleId),
        onSuccess: () => { toast.success('Módulo removido.'); invalidateModules(); },
        onError: (error: any) => toast.error(error?.response?.data?.message || 'Não foi possível remover o módulo.'),
    });

    const createLessonMutation = useMutation({
        mutationFn: (input: { moduleId: string; title: string; videoUrl?: string; duration?: number }) => courseLessonsApi.create(courseId, input),
        onSuccess: () => { toast.success('Aula adicionada.'); invalidateModules(); setLessonModalModuleId(null); },
        onError: (error: any) => toast.error(error?.response?.data?.message || 'Não foi possível adicionar a aula.'),
    });

    const removeLessonMutation = useMutation({
        mutationFn: (lessonId: string) => courseLessonsApi.remove(courseId, lessonId),
        onSuccess: () => { toast.success('Aula removida.'); invalidateModules(); },
        onError: (error: any) => toast.error(error?.response?.data?.message || 'Não foi possível remover a aula.'),
    });

    const progressMutation = useMutation({
        mutationFn: ({ lessonId, completed }: { lessonId: string; completed: boolean }) => courseLessonsApi.markProgress(courseId, lessonId, completed),
        onSuccess: () => invalidateModules(),
        onError: (error: any) => toast.error(error?.response?.data?.message || 'Não foi possível salvar o progresso.'),
    });

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.75rem' }}>
                <Button onClick={() => { resetModule({ title: '' }); setModuleModalOpen(true); }}>
                    <Plus size={16} /> Novo módulo
                </Button>
            </div>

            {(modules ?? []).map((courseModule) => (
                <ModuleCard key={courseModule.id}>
                    <ModuleHeader>
                        <h3>{courseModule.title}</h3>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <Button $variant="ghost" onClick={() => { resetLesson({ title: '', videoUrl: '', duration: '' }); setLessonModalModuleId(courseModule.id); }}>
                                <Plus size={14} /> Aula
                            </Button>
                            <Button $variant="ghost" onClick={() => removeModuleMutation.mutate(courseModule.id)}>
                                <Trash2 size={14} />
                            </Button>
                        </div>
                    </ModuleHeader>

                    {courseModule.lessons.length === 0 && <span style={{ fontSize: '0.8125rem', color: '#6c757d' }}>Nenhuma aula neste módulo ainda.</span>}

                    {courseModule.lessons.map((lesson) => {
                        const completed = lesson.progress?.[0]?.completed ?? false;
                        return (
                            <LessonRow key={lesson.id}>
                                <button
                                    type="button"
                                    onClick={() => progressMutation.mutate({ lessonId: lesson.id, completed: !completed })}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', color: completed ? '#28a745' : '#adb5bd' }}
                                    title={completed ? 'Marcar como não assistida' : 'Marcar como assistida'}
                                >
                                    {completed ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                                </button>
                                <LessonTitle>
                                    <strong>{lesson.title}</strong>
                                    {lesson.duration && <span>{Math.round(lesson.duration / 60)} min</span>}
                                </LessonTitle>
                                {lesson.videoUrl && (
                                    <Button as="a" href={lesson.videoUrl} target="_blank" rel="noreferrer" $variant="ghost">
                                        <PlayCircle size={14} /> Assistir
                                    </Button>
                                )}
                                <Button $variant="ghost" onClick={() => removeLessonMutation.mutate(lesson.id)}>
                                    <Trash2 size={14} />
                                </Button>
                            </LessonRow>
                        );
                    })}
                </ModuleCard>
            ))}

            {(modules ?? []).length === 0 && (
                <TableWrapper>
                    <EmptyState>Nenhum módulo de vídeo-aula criado ainda.</EmptyState>
                </TableWrapper>
            )}

            <Modal open={moduleModalOpen} onOpenChange={setModuleModalOpen} title="Novo módulo">
                <Form onSubmit={handleSubmitModule((data) => createModuleMutation.mutate(data.title))}>
                    <Field>
                        <Label htmlFor="moduleTitle">Título do módulo</Label>
                        <Input id="moduleTitle" placeholder="ex: Módulo 1 — Fundamentos" {...registerModule('title', { required: true })} />
                    </Field>
                    <FormActions>
                        <Button type="button" $variant="secondary" onClick={() => setModuleModalOpen(false)}>Cancelar</Button>
                        <Button type="submit" disabled={createModuleMutation.isPending}>{createModuleMutation.isPending ? 'Salvando...' : 'Criar'}</Button>
                    </FormActions>
                </Form>
            </Modal>

            <Modal open={!!lessonModalModuleId} onOpenChange={(open) => !open && setLessonModalModuleId(null)} title="Nova aula">
                <Form
                    onSubmit={handleSubmitLesson((data) => {
                        if (!lessonModalModuleId) return;
                        createLessonMutation.mutate({
                            moduleId: lessonModalModuleId,
                            title: data.title,
                            videoUrl: data.videoUrl || undefined,
                            duration: data.duration ? Number(data.duration) * 60 : undefined,
                        });
                    })}
                >
                    <Field>
                        <Label htmlFor="lessonTitle">Título da aula</Label>
                        <Input id="lessonTitle" {...registerLesson('title', { required: true })} />
                    </Field>
                    <Field>
                        <Label htmlFor="videoUrl">Link do vídeo</Label>
                        <Input id="videoUrl" placeholder="https://..." {...registerLesson('videoUrl')} />
                    </Field>
                    <Field>
                        <Label htmlFor="duration">Duração (minutos, opcional)</Label>
                        <Input id="duration" type="number" min={0} {...registerLesson('duration')} />
                    </Field>
                    <FormActions>
                        <Button type="button" $variant="secondary" onClick={() => setLessonModalModuleId(null)}>Cancelar</Button>
                        <Button type="submit" disabled={createLessonMutation.isPending}>{createLessonMutation.isPending ? 'Salvando...' : 'Adicionar'}</Button>
                    </FormActions>
                </Form>
            </Modal>
        </div>
    );
}

function AttendanceModal({
    courseId,
    session,
    onClose,
}: {
    courseId: string;
    session: { id: string; date: string; classLog?: { content: string } | null };
    enrollmentsCount: number;
    onClose: () => void;
}) {
    const queryClient = useQueryClient();
    const [statusByEnrollment, setStatusByEnrollment] = useState<Record<string, AttendanceStatus>>({});
    const [logContent, setLogContent] = useState(session.classLog?.content ?? '');

    const { data: roster, isLoading } = useQuery({
        queryKey: ['courses', courseId, 'sessions', session.id, 'attendance'],
        queryFn: () => classSessionsApi.getAttendance(courseId, session.id),
    });

    const markAttendanceMutation = useMutation({
        mutationFn: (records: { enrollmentId: string; status: AttendanceStatus }[]) =>
            classSessionsApi.markAttendance(courseId, session.id, records),
        onSuccess: () => {
            toast.success('Presença registrada com sucesso.');
            queryClient.invalidateQueries({ queryKey: ['courses', courseId, 'sessions'] });
            queryClient.invalidateQueries({ queryKey: ['courses', courseId, 'sessions', session.id, 'attendance'] });
        },
        onError: (error: any) => toast.error(error?.response?.data?.message || 'Não foi possível salvar a presença.'),
    });

    const upsertLogMutation = useMutation({
        mutationFn: (content: string) => classSessionsApi.upsertLog(courseId, session.id, content),
        onSuccess: () => {
            toast.success('Diário de aula salvo.');
            queryClient.invalidateQueries({ queryKey: ['courses', courseId, 'sessions'] });
        },
        onError: (error: any) => toast.error(error?.response?.data?.message || 'Não foi possível salvar o diário de aula.'),
    });

    const getStatus = (enrollmentId: string, fallback: AttendanceStatus | null): AttendanceStatus | '' =>
        statusByEnrollment[enrollmentId] ?? fallback ?? '';

    const handleSaveAttendance = () => {
        const records = (roster ?? [])
            .map((entry) => ({ enrollmentId: entry.enrollmentId, status: getStatus(entry.enrollmentId, entry.status) }))
            .filter((r): r is { enrollmentId: string; status: AttendanceStatus } => r.status !== '');
        markAttendanceMutation.mutate(records);
    };

    return (
        <Modal open onOpenChange={(open) => !open && onClose()} title={`Chamada — ${format(new Date(session.date), 'dd/MM/yyyy')}`} width="560px">
            {isLoading ? (
                <EmptyState>Carregando...</EmptyState>
            ) : (
                <>
                    <TableWrapper>
                        <Table>
                            <Thead>
                                <tr>
                                    <Th>Aluno</Th>
                                    <Th>Presença</Th>
                                </tr>
                            </Thead>
                            <tbody>
                                {(roster ?? []).map((entry) => (
                                    <Tr key={entry.enrollmentId}>
                                        <Td>{entry.student.name}</Td>
                                        <Td>
                                            <Select
                                                value={getStatus(entry.enrollmentId, entry.status)}
                                                onChange={(e) =>
                                                    setStatusByEnrollment((prev) => ({ ...prev, [entry.enrollmentId]: e.target.value as AttendanceStatus }))
                                                }
                                            >
                                                <option value="">Não lançada</option>
                                                <option value="PRESENT">{ATTENDANCE_LABEL.PRESENT}</option>
                                                <option value="ABSENT">{ATTENDANCE_LABEL.ABSENT}</option>
                                                <option value="JUSTIFIED_ABSENT">{ATTENDANCE_LABEL.JUSTIFIED_ABSENT}</option>
                                            </Select>
                                        </Td>
                                    </Tr>
                                ))}
                            </tbody>
                        </Table>
                        {(roster ?? []).length === 0 && <EmptyState>Nenhum aluno matriculado nesta turma ainda.</EmptyState>}
                    </TableWrapper>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', margin: '0.75rem 0 1.25rem' }}>
                        <Button onClick={handleSaveAttendance} disabled={markAttendanceMutation.isPending}>
                            {markAttendanceMutation.isPending ? 'Salvando...' : 'Salvar presença'}
                        </Button>
                    </div>

                    <Field>
                        <Label htmlFor="classLog">Diário de aula</Label>
                        <Textarea
                            id="classLog"
                            placeholder="Conteúdo abordado na aula..."
                            value={logContent}
                            onChange={(e) => setLogContent(e.target.value)}
                        />
                    </Field>
                    <FormActions>
                        <Button type="button" $variant="secondary" onClick={onClose}>Fechar</Button>
                        <Button
                            type="button"
                            onClick={() => upsertLogMutation.mutate(logContent)}
                            disabled={!logContent.trim() || upsertLogMutation.isPending}
                        >
                            {upsertLogMutation.isPending ? 'Salvando...' : 'Salvar diário'}
                        </Button>
                    </FormActions>
                </>
            )}
        </Modal>
    );
}
