// frontend/src/pages/CourseDetail.tsx
//
// Detalhe de uma turma: agenda (aulas + chamada + diário), vídeo-aulas e matrículas. A emissão
// automática de certificado por critério de presença (decisão 16/17 do docs/decisoes.md) fica
// no módulo de certificados — aqui só mostramos/coletamos os dados que ele consome.
// Cada aba mora em pages/course-detail/. Agenda = aulas/períodos onde se faz a chamada;
// Programação = o que acontece dentro deles (atividades de cada grupo, ver ScheduleTab).

import { useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import * as Tabs from '@radix-ui/react-tabs';
import styled from 'styled-components';
import { ArrowLeft, ClipboardList, Pencil, Trash2 } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageLayout } from '@/components/layout/PageLayout';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/Table';
import { toast } from '@/utils/toast';
import { coursesApi, classSessionsApi, enrollmentsApi } from '@/services/courses';
import { useAuth } from '@/contexts/AuthContext';
import { hasPermission } from '@/utils/permissions';
import { scrollFade, useScrollFade } from '@/components/ui/scrollFade';
import { CourseSummary } from '@/pages/course-detail/CourseSummary';
import { SessionsTab } from '@/pages/course-detail/SessionsTab';
import { LessonsTab } from '@/pages/course-detail/LessonsTab';
import { StudentLessons } from '@/pages/course-detail/lessons/StudentLessons';
import { EnrollmentsTab } from '@/pages/course-detail/EnrollmentsTab';
import { AttendanceModal } from '@/pages/course-detail/AttendanceModal';
import { EditCourseModal } from '@/pages/course-detail/EditCourseModal';
import { MyProgress } from '@/pages/course-detail/MyProgress';
import { ScheduleTab } from '@/pages/course-detail/ScheduleTab';

const TABS = ['sessions', 'schedule', 'lessons', 'enrollments'] as const;
type TabValue = (typeof TABS)[number];

const TabsList = styled(Tabs.List)`
    display: flex;
    gap: 1rem;
    border-bottom: 1px solid ${({ theme }) => theme.colors.borderLight};
    margin-bottom: 1rem;
    overflow-x: auto;
    ${scrollFade}
`;

const TabsTrigger = styled(Tabs.Trigger)`
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.6rem 0.25rem;
    background: transparent;
    border: none;
    border-bottom: 2px solid transparent;
    font-size: 0.875rem;
    font-weight: 600;
    color: ${({ theme }) => theme.colors.textMuted};
    cursor: pointer;
    white-space: nowrap;

    &:hover {
        color: ${({ theme }) => theme.colors.textDark};
    }

    &[data-state='active'] {
        color: ${({ theme }) => theme.colors.primary};
        border-bottom-color: ${({ theme }) => theme.colors.primary};
    }
`;

const TabCount = styled.span`
    padding: 0 0.45rem;
    border-radius: ${({ theme }) => theme.radii.pill};
    background: ${({ theme }) => theme.colors.backgroundMedium};
    color: ${({ theme }) => theme.colors.textMedium};
    font-size: 0.7rem;
    font-weight: 700;
    line-height: 1.4;
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

export default function CourseDetail() {
    const { id } = useParams<{ id: string }>();
    const courseId = id!;
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [searchParams, setSearchParams] = useSearchParams();

    const [editModalOpen, setEditModalOpen] = useState(false);
    const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

    const { user } = useAuth();
    // Gestão da turma (editar, agendar aula, matricular, mudar status) exige `courses:manage`
    // no backend; instrutor da turma só lança chamada/diário e edita as próprias vídeo-aulas.
    const canManage = hasPermission(user, 'courses:manage');
    // Emissão manual de certificado é um módulo à parte (certificates:manage).
    const canIssueCertificates = hasPermission(user, 'certificates:manage');
    // A lista de alunos (nome e e-mail) é só da coordenação e dos instrutores da turma; o backend
    // recusa para os demais. Aluno vê a turma do ponto de vista dele (MyProgress).
    const teachesThisCourse = user?.instructorCourseIds?.includes(courseId) ?? false;
    const canSeeRoster = canManage || teachesThisCourse;

    const { data: course, isLoading, isError } = useQuery({ queryKey: ['courses', courseId], queryFn: () => coursesApi.get(courseId) });
    const { data: sessions } = useQuery({ queryKey: ['courses', courseId, 'sessions'], queryFn: () => classSessionsApi.list(courseId) });
    const { data: enrollments } = useQuery({ queryKey: ['courses', courseId, 'enrollments'], queryFn: () => enrollmentsApi.list(courseId), enabled: canSeeRoster });

    const requestedTab = searchParams.get('tab');
    const activeTab: TabValue =
        TABS.includes(requestedTab as TabValue) && (requestedTab !== 'enrollments' || canSeeRoster) ? (requestedTab as TabValue) : 'sessions';
    // `replace` para trocar de aba não empilhar histórico; o link com ?tab= abre direto na aba.
    const changeTab = (value: string) => setSearchParams(value === 'sessions' ? {} : { tab: value }, { replace: true });
    const tabsRef = useScrollFade<HTMLDivElement>(activeTab);

    // Instrutor não tem acesso à lista completa de turmas (/courses), só a /my-courses.
    const backPath = canManage ? '/courses' : '/my-courses';
    const backLabel = canManage ? 'Voltar para turmas' : 'Voltar para minhas turmas';

    const removeCourseMutation = useMutation({
        mutationFn: () => coursesApi.remove(courseId),
        onSuccess: () => {
            toast.success('Turma excluída.');
            queryClient.invalidateQueries({ queryKey: ['courses'] });
            navigate(backPath);
        },
        onError: (error: any) => toast.error(error?.response?.data?.message || 'Não foi possível excluir a turma.'),
    });

    if (!course) {
        return (
            <PageLayout title="Turma" icon={<ClipboardList size={16} />}>
                <BackLink onClick={() => navigate(backPath)}>
                    <ArrowLeft size={14} /> {backLabel}
                </BackLink>
                <EmptyState>{isError ? 'Não foi possível carregar esta turma. Ela pode ter sido removida ou você não tem acesso.' : isLoading ? 'Carregando...' : ''}</EmptyState>
            </PageLayout>
        );
    }

    const activeSession = (sessions ?? []).find((s) => s.id === activeSessionId) ?? null;
    const isInstructor = course.instructors.some((i) => i.userId === user?.id);
    // Lista de chamada de um grupo = alunos ativos dele (mesmo filtro do backend).
    const groupSizes = (enrollments ?? []).reduce<Record<string, number>>((acc, e) => {
        if (e.groupId && e.status === 'ACTIVE') acc[e.groupId] = (acc[e.groupId] ?? 0) + 1;
        return acc;
    }, {});

    const handleDeleteCourse = () => {
        const confirmed = window.confirm(
            `Excluir a turma "${course.event.title}"? As matrículas dela deixarão de aparecer no sistema. Ela vai para a lixeira, de onde pode ser restaurada.`,
        );
        if (confirmed) removeCourseMutation.mutate();
    };

    return (
        <PageLayout
            title={course.event.title}
            subtitle={course.category || undefined}
            icon={<ClipboardList size={16} />}
            actions={
                canManage ? (
                    <>
                        <Button $variant="secondary" onClick={() => setEditModalOpen(true)}>
                            <Pencil size={14} /> Editar turma
                        </Button>
                        <Button $variant="danger" onClick={handleDeleteCourse} disabled={removeCourseMutation.isPending}>
                            <Trash2 size={14} /> Excluir
                        </Button>
                    </>
                ) : undefined
            }
        >
            <BackLink onClick={() => navigate(backPath)}>
                <ArrowLeft size={14} /> {backLabel}
            </BackLink>

            {/* Aluno: o que importa para ele (próxima aula, presença, progresso) vem antes dos dados administrativos. */}
            {!canManage && <MyProgress courseId={courseId} sessions={sessions ?? []} />}

            <CourseSummary course={course} studentView={!canSeeRoster} />

            <Tabs.Root value={activeTab} onValueChange={changeTab}>
                <TabsList ref={tabsRef} aria-label="Seções da turma">
                    <TabsTrigger value="sessions">Agenda <TabCount>{sessions?.length ?? course._count.sessions}</TabCount></TabsTrigger>
                    <TabsTrigger value="schedule">Programação</TabsTrigger>
                    <TabsTrigger value="lessons">Vídeo-aulas</TabsTrigger>
                    {canSeeRoster && (
                        <TabsTrigger value="enrollments">Matrículas <TabCount>{enrollments?.length ?? course._count.enrollments}</TabCount></TabsTrigger>
                    )}
                </TabsList>

                <Tabs.Content value="sessions">
                    <SessionsTab
                        courseId={courseId}
                        sessions={sessions ?? []}
                        enrollmentsCount={enrollments?.length ?? 0}
                        canManage={canManage}
                        courseInstructors={course.instructors}
                        currentUserId={user?.id}
                        studentView={!canSeeRoster}
                        groups={course.groups ?? []}
                        groupSizes={groupSizes}
                        defaultRoomId={course.defaultRoomId}
                        vacancies={course.vacancies}
                        onOpenAttendance={setActiveSessionId}
                    />
                </Tabs.Content>

                <Tabs.Content value="schedule">
                    <ScheduleTab courseId={courseId} canManage={canManage} courseStartDate={course.event.startDate} courseTitle={course.event.title} />
                </Tabs.Content>

                <Tabs.Content value="lessons">
                    {canSeeRoster ? (
                        <LessonsTab
                            courseId={courseId}
                            canManageCourse={canManage}
                            isCourseInstructor={isInstructor}
                            courseInstructors={course.instructors}
                            currentUserId={user?.id}
                        />
                    ) : (
                        <StudentLessons courseId={courseId} lessonsRequired={course.requireAllLessonsWatched} />
                    )}
                </Tabs.Content>

                {canSeeRoster && (
                    <Tabs.Content value="enrollments">
                        <EnrollmentsTab
                            courseId={courseId}
                            enrollments={enrollments ?? []}
                            canManage={canManage}
                            canIssueCertificates={canIssueCertificates}
                            groups={course.groups ?? []}
                            onCourseChanged={() => queryClient.invalidateQueries({ queryKey: ['courses', courseId] })}
                        />
                    </Tabs.Content>
                )}
            </Tabs.Root>

            {/* Chamada de presença + diário de aula */}
            {activeSession && <AttendanceModal courseId={courseId} session={activeSession} currentUserId={user?.id} onClose={() => setActiveSessionId(null)} />}

            {canManage && <EditCourseModal course={course} open={editModalOpen} onOpenChange={setEditModalOpen} />}
        </PageLayout>
    );
}
