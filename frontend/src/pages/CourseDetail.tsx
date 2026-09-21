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
import { ArrowLeft, Plus, ClipboardList, PlayCircle, CheckCircle2, Circle, Trash2, Pencil } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { PageLayout } from '@/components/layout/PageLayout';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Field, Label, Input, Select, Textarea, ErrorText, HelpText, Form, FormActions, FieldRow } from '@/components/ui/FormField';
import { Table, TableWrapper, Thead, Tr, Th, Td, EmptyState, Badge } from '@/components/ui/Table';
import { coursesApi, roomsApi, classSessionsApi, enrollmentsApi, courseModulesApi, courseLessonsApi, type CourseLesson, type CourseLessonInput } from '@/services/courses';
import { certificatesApi } from '@/services/certificates';
import { peopleApi } from '@/services/people';
import { mediaApi } from '@/services/media';
import { toast } from '@/utils/toast';
import { useAuth } from '@/contexts/AuthContext';
import { hasPermission } from '@/utils/permissions';
import { RichTextEditor } from '@/components/ui/RichTextEditor';
import { RichTextViewer } from '@/components/ui/RichTextViewer';
import type { AttendanceStatus, EnrollmentStatus } from '@/types';

const VIDEO_ALLOWED_TYPES = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-matroska'];
const VIDEO_MAX_SIZE = 500 * 1024 * 1024; // 500MB — mesmo teto do contexto 'course-lessons' em media.service.ts

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

interface EditCourseFormData {
    minAttendancePercent: string;
    requireAllLessonsWatched: boolean;
    recyclingValidityMonths: string;
    recommendedRecyclingCourseId: string;
    syllabus: string;
}

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
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

    const { user } = useAuth();
    // Matricular aluno (mutation abaixo) exige `courses:manage` no backend — buscar a
    // lista de pessoas sem essa permissão só gera um 403 (e o toast de erro do
    // interceptor global) para quem nunca vai conseguir usar o dropdown mesmo.
    const canManageEnrollments = hasPermission(user, 'courses:manage');
    // Editar critérios de certificado também exige courses:manage (PATCH /courses/:id).
    const canEditCourse = canManageEnrollments;
    // Emissão manual de certificado é um módulo à parte (certificates:manage), não courses:manage.
    const canIssueCertificates = hasPermission(user, 'certificates:manage');

    const { data: course } = useQuery({ queryKey: ['courses', courseId], queryFn: () => coursesApi.get(courseId) });
    const { data: sessions } = useQuery({ queryKey: ['courses', courseId, 'sessions'], queryFn: () => classSessionsApi.list(courseId) });
    const { data: enrollments } = useQuery({ queryKey: ['courses', courseId, 'enrollments'], queryFn: () => enrollmentsApi.list(courseId) });
    const { data: rooms } = useQuery({ queryKey: ['rooms'], queryFn: () => roomsApi.list() });
    const { data: peopleData } = useQuery({
        queryKey: ['people', { hasStudentProfile: true }],
        queryFn: () => peopleApi.list({ hasStudentProfile: true }),
        enabled: canManageEnrollments,
    });
    // Só pra popular o seletor de "curso de reciclagem recomendado" no modal de editar.
    const { data: allCoursesData } = useQuery({
        queryKey: ['courses'],
        queryFn: () => coursesApi.list(),
        enabled: canEditCourse,
    });

    const invalidateCourse = () => {
        queryClient.invalidateQueries({ queryKey: ['courses', courseId] });
    };

    const { register: registerEdit, handleSubmit: handleSubmitEdit, reset: resetEdit } = useForm<EditCourseFormData>();

    const openEdit = () => {
        if (!course) return;
        resetEdit({
            minAttendancePercent: String(course.minAttendancePercent),
            requireAllLessonsWatched: course.requireAllLessonsWatched,
            recyclingValidityMonths: course.recyclingValidityMonths ? String(course.recyclingValidityMonths) : '',
            recommendedRecyclingCourseId: course.recommendedRecyclingCourseId || '',
            syllabus: course.syllabus || '',
        });
        setEditModalOpen(true);
    };

    const updateCourseMutation = useMutation({
        mutationFn: (input: EditCourseFormData) =>
            coursesApi.update(courseId, {
                minAttendancePercent: input.minAttendancePercent ? Number(input.minAttendancePercent) : undefined,
                requireAllLessonsWatched: input.requireAllLessonsWatched,
                recyclingValidityMonths: input.recyclingValidityMonths ? Number(input.recyclingValidityMonths) : undefined,
                recommendedRecyclingCourseId: input.recommendedRecyclingCourseId || undefined,
                syllabus: input.syllabus || undefined,
            }),
        onSuccess: () => {
            toast.success('Critérios de certificado atualizados.');
            invalidateCourse();
            setEditModalOpen(false);
        },
        onError: (error: any) => toast.error(error?.response?.data?.message || 'Não foi possível salvar.'),
    });

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

    const [enrollUserIds, setEnrollUserIds] = useState<string[]>([]);
    const toggleEnrollUserId = (id: string) => {
        setEnrollUserIds((current) => (current.includes(id) ? current.filter((u) => u !== id) : [...current, id]));
    };
    const enrollMutation = useMutation({
        mutationFn: async (userIds: string[]) =>
            userIds.length === 1 ? [await enrollmentsApi.enroll(courseId, userIds[0])] : enrollmentsApi.enrollBulk(courseId, userIds),
        onSuccess: (_, userIds) => {
            toast.success(userIds.length > 1 ? `${userIds.length} alunos matriculados com sucesso.` : 'Aluno matriculado com sucesso.');
            queryClient.invalidateQueries({ queryKey: ['courses', courseId, 'enrollments'] });
            invalidateCourse();
            setEnrollModalOpen(false);
            setEnrollUserIds([]);
        },
        onError: (error: any) => toast.error(error?.response?.data?.message || 'Não foi possível matricular os alunos selecionados.'),
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

    /**
     * Emissão manual de certificado (admin), fora do caminho automático por
     * presença/aulas. Primeiro tenta sem forçar — se a matrícula ainda não
     * atingiu os critérios da turma, pergunta se quer emitir mesmo assim
     * (`force`), pra não precisar que o aluno "percorra o caminho das aulas".
     */
    const issueCertificateMutation = useMutation({
        mutationFn: ({ enrollmentId, force }: { enrollmentId: string; force?: boolean }) => certificatesApi.issue(enrollmentId, force),
        onSuccess: () => {
            toast.success('Certificado emitido.');
            queryClient.invalidateQueries({ queryKey: ['courses', courseId, 'enrollments'] });
        },
        onError: (error: any, variables) => {
            const message = error?.response?.data?.message;
            const status = error?.response?.status;
            if (!variables.force && status === 400 && message) {
                if (window.confirm(`${message}\n\nEmitir o certificado mesmo assim, ignorando esse critério?`)) {
                    issueCertificateMutation.mutate({ enrollmentId: variables.enrollmentId, force: true });
                }
                return;
            }
            toast.error(message || 'Não foi possível emitir o certificado.');
        },
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
            actions={canEditCourse ? <Button $variant="secondary" onClick={openEdit}>Editar critérios</Button> : undefined}
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
                <span><strong>Todas as aulas obrigatórias:</strong> {course.requireAllLessonsWatched ? 'Sim' : 'Não'}</span>
                <span><strong>Validade do certificado:</strong> {course.recyclingValidityMonths ? `${course.recyclingValidityMonths} meses` : 'Sem vencimento'}</span>
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
                    <LessonsTab
                        courseId={courseId}
                        canManageCourse={canManageEnrollments}
                        canEditLessons={canManageEnrollments || course.instructors.some((i) => i.userId === user?.id)}
                    />
                </Tabs.Content>

                <Tabs.Content value="enrollments">
                    {canManageEnrollments && (
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.75rem' }}>
                            <Button onClick={() => { setEnrollUserIds([]); setEnrollModalOpen(true); }}>
                                <Plus size={16} /> Matricular aluno
                            </Button>
                        </div>
                    )}
                    <TableWrapper>
                        <Table>
                            <Thead>
                                <tr>
                                    <Th>Aluno</Th>
                                    <Th>E-mail</Th>
                                    <Th>Status</Th>
                                    <Th>Alterar status</Th>
                                    {canIssueCertificates && <Th>Certificado</Th>}
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
                                        {canIssueCertificates && (
                                            <Td>
                                                {enrollment.certificate ? (
                                                    <Badge $tone="success">Emitido</Badge>
                                                ) : (
                                                    <Button
                                                        $variant="ghost"
                                                        disabled={issueCertificateMutation.isPending}
                                                        onClick={() => issueCertificateMutation.mutate({ enrollmentId: enrollment.id })}
                                                    >
                                                        Emitir certificado
                                                    </Button>
                                                )}
                                            </Td>
                                        )}
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

            {/* Matricular aluno(s) */}
            <Modal open={enrollModalOpen} onOpenChange={setEnrollModalOpen} title="Matricular alunos">
                <Form onSubmit={(e) => { e.preventDefault(); if (enrollUserIds.length > 0) enrollMutation.mutate(enrollUserIds); }}>
                    <Field>
                        <Label>Alunos</Label>
                        <HelpText>Selecione um ou mais alunos para matricular de uma vez.</HelpText>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: 280, overflowY: 'auto' }}>
                            {availableStudents.map((student) => (
                                <label key={student.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', padding: '0.2rem 0' }}>
                                    <input
                                        type="checkbox"
                                        checked={enrollUserIds.includes(student.id)}
                                        onChange={() => toggleEnrollUserId(student.id)}
                                    />
                                    {student.name} — {student.email}
                                </label>
                            ))}
                        </div>
                        {availableStudents.length === 0 && (
                            <ErrorText>Todos os alunos cadastrados já estão matriculados, ou nenhum aluno foi cadastrado ainda.</ErrorText>
                        )}
                    </Field>
                    <FormActions>
                        <Button type="button" $variant="secondary" onClick={() => setEnrollModalOpen(false)}>Cancelar</Button>
                        <Button type="submit" disabled={enrollUserIds.length === 0 || enrollMutation.isPending}>
                            {enrollMutation.isPending
                                ? 'Matriculando...'
                                : enrollUserIds.length > 1
                                  ? `Matricular ${enrollUserIds.length} alunos`
                                  : 'Matricular'}
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

            {/* Editar critérios de certificado (decisão 17/19, docs/decisoes.md) */}
            <Modal open={editModalOpen} onOpenChange={setEditModalOpen} title="Editar critérios de certificado">
                <Form onSubmit={handleSubmitEdit((data) => updateCourseMutation.mutate(data))}>
                    <FieldRow>
                        <Field>
                            <Label htmlFor="editMinAttendancePercent">Presença mínima p/ certificado (%)</Label>
                            <Input id="editMinAttendancePercent" type="number" min={0} max={100} {...registerEdit('minAttendancePercent')} />
                        </Field>
                        <Field>
                            <Label htmlFor="editRecyclingValidityMonths">Validade do certificado (meses, opcional)</Label>
                            <Input id="editRecyclingValidityMonths" type="number" min={1} placeholder="sem vencimento" {...registerEdit('recyclingValidityMonths')} />
                        </Field>
                    </FieldRow>
                    <Field>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem' }}>
                            <input type="checkbox" {...registerEdit('requireAllLessonsWatched')} />
                            Exigir todas as vídeo-aulas assistidas para emitir o certificado
                        </label>
                    </Field>
                    <Field>
                        <Label htmlFor="editRecommendedRecyclingCourseId">Curso de reciclagem recomendado (opcional)</Label>
                        <Select id="editRecommendedRecyclingCourseId" {...registerEdit('recommendedRecyclingCourseId')}>
                            <option value="">Nenhum</option>
                            {(allCoursesData?.data ?? []).filter((c) => c.id !== courseId).map((c) => (
                                <option key={c.id} value={c.id}>{c.event.title}</option>
                            ))}
                        </Select>
                    </Field>
                    <Field>
                        <Label htmlFor="editSyllabus">Conteúdo programático (opcional)</Label>
                        <Textarea
                            id="editSyllabus"
                            rows={5}
                            placeholder="Cole ou escreva a ementa da turma — vira uma 2ª página no PDF do certificado."
                            {...registerEdit('syllabus')}
                        />
                    </Field>
                    <FormActions>
                        <Button type="button" $variant="secondary" onClick={() => setEditModalOpen(false)}>Cancelar</Button>
                        <Button type="submit" disabled={updateCourseMutation.isPending}>
                            {updateCourseMutation.isPending ? 'Salvando...' : 'Salvar'}
                        </Button>
                    </FormActions>
                </Form>
            </Modal>
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

const LessonItem = styled.div`
    padding: 0.5rem 0;
    border-top: 1px solid ${({ theme }) => theme.colors.borderLight};

    &:first-of-type { border-top: none; }
`;

const LessonRow = styled.div`
    display: flex;
    align-items: center;
    gap: 0.65rem;
    font-size: 0.8125rem;
`;

const LessonTitle = styled.div`
    flex: 1;
    display: flex;
    flex-direction: column;

    strong { color: ${({ theme }) => theme.colors.textDark}; }
    span { font-size: 0.7rem; color: ${({ theme }) => theme.colors.textMuted}; }
`;

const LessonExtra = styled.div`
    margin-top: 0.5rem;
    margin-left: 1.9rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;

    video {
        display: block;
        width: auto;
        height: auto;
        max-width: 100%;
        max-height: 360px;
        border-radius: ${({ theme }) => theme.radii.sm};
        background: #000;
    }
`;

/**
 * Módulos + aulas em vídeo de uma turma (decisão de reaproveitamento em
 * docs/decisoes.md: TrainingModule/Lesson/Progress do maskotCrmEdu, agora
 * escopado por Course). Vídeo pode ser um link colado (videoUrl, sem
 * videoKey) ou um arquivo enviado direto pro R2 via presigned URL
 * (videoUrl = URL pública do upload, videoKey = chave no bucket) — o player
 * embutido só é usado para vídeo próprio (videoKey presente); link externo
 * abre em nova aba, já que não dá pra assumir que é embutível.
 */
function LessonsTab({
    courseId,
    canManageCourse,
    canEditLessons,
}: {
    courseId: string;
    /** Módulos (criar/editar/excluir) e excluir aula exigem courses:manage — mesmo gate do backend. */
    canManageCourse: boolean;
    /** Criar/editar aula é liberado também pra instrutor da turma (course-lessons.controller.ts). */
    canEditLessons: boolean;
}) {
    const [moduleModalOpen, setModuleModalOpen] = useState(false);
    const [lessonModalModuleId, setLessonModalModuleId] = useState<string | null>(null);
    const [editingLesson, setEditingLesson] = useState<CourseLesson | null>(null);
    const [lessonMode, setLessonMode] = useState<'link' | 'upload'>('link');
    const [lessonFile, setLessonFile] = useState<File | null>(null);
    const [isUploadingVideo, setIsUploadingVideo] = useState(false);
    const [lessonContent, setLessonContent] = useState('');
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

    const closeLessonModal = () => {
        setLessonModalModuleId(null);
        setEditingLesson(null);
        setLessonFile(null);
    };

    const openCreateLesson = (moduleId: string) => {
        resetLesson({ title: '', videoUrl: '', duration: '' });
        setLessonContent('');
        setLessonMode('link');
        setLessonFile(null);
        setEditingLesson(null);
        setLessonModalModuleId(moduleId);
    };

    const openEditLesson = (lesson: CourseLesson) => {
        resetLesson({
            title: lesson.title,
            videoUrl: lesson.videoKey ? '' : lesson.videoUrl ?? '',
            duration: lesson.duration ? String(Math.round(lesson.duration / 60)) : '',
        });
        setLessonContent(lesson.content ?? '');
        setLessonMode(lesson.videoKey ? 'upload' : 'link');
        setLessonFile(null);
        setEditingLesson(lesson);
        setLessonModalModuleId(lesson.moduleId);
    };

    const saveLessonMutation = useMutation({
        mutationFn: async (data: { title: string; videoUrl: string; duration: string }) => {
            const moduleId = editingLesson?.moduleId ?? lessonModalModuleId;
            if (!moduleId) throw new Error('Módulo não selecionado.');

            const payload: Partial<CourseLessonInput> = {
                title: data.title,
                content: lessonContent,
                duration: data.duration ? Number(data.duration) * 60 : undefined,
            };

            if (lessonMode === 'upload') {
                if (lessonFile) {
                    if (!VIDEO_ALLOWED_TYPES.includes(lessonFile.type)) {
                        throw new Error('Tipo de arquivo não permitido. Envie um vídeo MP4, MOV, WEBM ou MKV.');
                    }
                    if (lessonFile.size > VIDEO_MAX_SIZE) {
                        throw new Error('O vídeo deve ter no máximo 500MB.');
                    }
                    setIsUploadingVideo(true);
                    try {
                        const { fileUrl, storageKey } = await mediaApi.upload(lessonFile, 'course-lessons');
                        payload.videoUrl = fileUrl;
                        payload.videoKey = storageKey;
                    } finally {
                        setIsUploadingVideo(false);
                    }
                }
                // sem arquivo novo selecionado: mantém o vídeo atual (não mexe em videoUrl/videoKey)
            } else {
                payload.videoUrl = data.videoUrl || undefined;
                if (editingLesson?.videoKey) {
                    payload.videoKey = null; // trocou de "arquivo enviado" pra link — limpa a chave antiga
                }
            }

            if (editingLesson) {
                return courseLessonsApi.update(courseId, editingLesson.id, payload);
            }
            return courseLessonsApi.create(courseId, { moduleId, ...payload } as CourseLessonInput);
        },
        onSuccess: () => {
            toast.success(editingLesson ? 'Aula atualizada.' : 'Aula adicionada.');
            invalidateModules();
            closeLessonModal();
        },
        onError: (error: any) =>
            toast.error(error?.response?.data?.message || error?.message || `Não foi possível ${editingLesson ? 'atualizar' : 'adicionar'} a aula.`),
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
            {canManageCourse && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.75rem' }}>
                    <Button onClick={() => { resetModule({ title: '' }); setModuleModalOpen(true); }}>
                        <Plus size={16} /> Novo módulo
                    </Button>
                </div>
            )}

            {(modules ?? []).map((courseModule) => (
                <ModuleCard key={courseModule.id}>
                    <ModuleHeader>
                        <h3>{courseModule.title}</h3>
                        {(canEditLessons || canManageCourse) && (
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                {canEditLessons && (
                                    <Button $variant="ghost" onClick={() => openCreateLesson(courseModule.id)}>
                                        <Plus size={14} /> Aula
                                    </Button>
                                )}
                                {canManageCourse && (
                                    <Button $variant="ghost" onClick={() => removeModuleMutation.mutate(courseModule.id)}>
                                        <Trash2 size={14} />
                                    </Button>
                                )}
                            </div>
                        )}
                    </ModuleHeader>

                    {courseModule.lessons.length === 0 && <span style={{ fontSize: '0.8125rem', color: '#6c757d' }}>Nenhuma aula neste módulo ainda.</span>}

                    {courseModule.lessons.map((lesson) => {
                        const completed = lesson.progress?.[0]?.completed ?? false;
                        const hasContent = Boolean(lesson.content && lesson.content !== '<p></p>');
                        return (
                            <LessonItem key={lesson.id}>
                                <LessonRow>
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
                                    {lesson.videoUrl && !lesson.videoKey && (
                                        <Button as="a" href={lesson.videoUrl} target="_blank" rel="noreferrer" $variant="ghost">
                                            <PlayCircle size={14} /> Assistir
                                        </Button>
                                    )}
                                    {canEditLessons && (
                                        <Button $variant="ghost" onClick={() => openEditLesson(lesson)}>
                                            <Pencil size={14} />
                                        </Button>
                                    )}
                                    {canManageCourse && (
                                        <Button $variant="ghost" onClick={() => removeLessonMutation.mutate(lesson.id)}>
                                            <Trash2 size={14} />
                                        </Button>
                                    )}
                                </LessonRow>
                                {(lesson.videoKey || hasContent) && (
                                    <LessonExtra>
                                        {lesson.videoKey && lesson.videoUrl && <video controls src={lesson.videoUrl} />}
                                        {hasContent && <RichTextViewer html={lesson.content!} />}
                                    </LessonExtra>
                                )}
                            </LessonItem>
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

            <Modal
                open={!!lessonModalModuleId}
                onOpenChange={(open) => !open && closeLessonModal()}
                title={editingLesson ? 'Editar aula' : 'Nova aula'}
                width="560px"
            >
                <Form onSubmit={handleSubmitLesson((data) => saveLessonMutation.mutate(data))}>
                    <Field>
                        <Label htmlFor="lessonTitle">Título da aula</Label>
                        <Input id="lessonTitle" {...registerLesson('title', { required: true })} />
                    </Field>

                    <Field>
                        <Label htmlFor="lessonMode">Vídeo</Label>
                        <Select id="lessonMode" value={lessonMode} onChange={(e) => setLessonMode(e.target.value as 'link' | 'upload')}>
                            <option value="link">Link (URL já hospedada)</option>
                            <option value="upload">Enviar arquivo de vídeo</option>
                        </Select>
                    </Field>

                    {lessonMode === 'link' ? (
                        <Field>
                            <Label htmlFor="videoUrl">Link do vídeo</Label>
                            <Input id="videoUrl" placeholder="https://..." {...registerLesson('videoUrl')} />
                        </Field>
                    ) : (
                        <Field>
                            <Label htmlFor="videoFile">Arquivo de vídeo</Label>
                            {editingLesson?.videoKey && !lessonFile && (
                                <HelpText>Já existe um vídeo enviado para esta aula. Selecione um novo arquivo abaixo para substituí-lo.</HelpText>
                            )}
                            <input
                                id="videoFile"
                                type="file"
                                accept={VIDEO_ALLOWED_TYPES.join(',')}
                                onChange={(e) => setLessonFile(e.target.files?.[0] ?? null)}
                            />
                            <HelpText>MP4, MOV, WEBM ou MKV, até 500MB.</HelpText>
                        </Field>
                    )}

                    <Field>
                        <Label htmlFor="duration">Duração (minutos, opcional)</Label>
                        <Input id="duration" type="number" min={0} {...registerLesson('duration')} />
                    </Field>

                    <Field>
                        <Label>Conteúdo (opcional)</Label>
                        <RichTextEditor value={lessonContent} onChange={setLessonContent} disabled={saveLessonMutation.isPending} />
                    </Field>

                    <FormActions>
                        <Button type="button" $variant="secondary" onClick={closeLessonModal}>Cancelar</Button>
                        <Button type="submit" disabled={saveLessonMutation.isPending}>
                            {isUploadingVideo ? 'Enviando vídeo...' : saveLessonMutation.isPending ? 'Salvando...' : editingLesson ? 'Salvar' : 'Adicionar'}
                        </Button>
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
