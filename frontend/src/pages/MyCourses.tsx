// frontend/src/pages/MyCourses.tsx
//
// Fase 3 de posse de dado (docs/decisoes.md): "minhas turmas" — as que o
// usuário leciona (instrutor) e/ou cursa (aluno matriculado), via /me/courses.
// Diferente de Courses.tsx (lista completa da organização, agora restrita a
// quem tem `courses:manage`), esta tela é para quem não administra turmas.
//
// Cada turma é um cartão: o aluno vê de relance quando é a próxima aula e quanto já andou
// (presença e vídeo-aulas) e entra direto nas aulas, sem abrir a turma para só então achar a aba.

import { CalendarClock, GraduationCap, PlayCircle } from 'lucide-react';
import styled from 'styled-components';
import { useNavigate } from 'react-router-dom';
import { useQueries, useQuery } from '@tanstack/react-query';
import { formatDateOnly, formatDateWithWeekday, sessionTiming } from '@/utils/courseDates';
import { PageLayout } from '@/components/layout/PageLayout';
import { Button } from '@/components/ui/Button';
import { EmptyState, Badge } from '@/components/ui/Table';
import { meApi, type MyCourse, type MyCourseProgress, type MyNextSession } from '@/services/me';
import { MiniProgress } from '@/pages/course-detail/styles';
import type { EventStatus } from '@/types';

const STATUS_LABEL: Record<EventStatus, string> = {
    SCHEDULED: 'Agendada',
    ONGOING: 'Em andamento',
    COMPLETED: 'Concluída',
    CANCELLED: 'Cancelada',
};

const STATUS_TONE: Record<EventStatus, 'neutral' | 'success' | 'info' | 'danger'> = {
    SCHEDULED: 'info',
    ONGOING: 'success',
    COMPLETED: 'neutral',
    CANCELLED: 'danger',
};

const SectionTitle = styled.h3`
    margin: 0 0 -0.25rem;
    font-size: 1rem;
`;

const Grid = styled.div`
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 1rem;

    @media (max-width: 400px) {
        grid-template-columns: minmax(0, 1fr);
    }
`;

const CourseCard = styled.article`
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
    min-width: 0;
    padding: 1rem 1.1rem;
    background: ${({ theme }) => theme.colors.white};
    border: 1px solid ${({ theme }) => theme.colors.borderLight};
    border-radius: ${({ theme }) => theme.radii.md};
    box-shadow: ${({ theme }) => theme.shadows.e1};
    transition: box-shadow 0.15s ease, border-color 0.15s ease;

    &:hover {
        box-shadow: ${({ theme }) => theme.shadows.e2};
    }

    header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 0.75rem;
    }

    h4 {
        margin: 0;
        font-size: 1rem;
        line-height: 1.3;
        overflow-wrap: anywhere;
    }

    .category {
        margin-top: 0.15rem;
        font-size: 0.75rem;
        color: ${({ theme }) => theme.colors.textMuted};
    }
`;

const NextSession = styled.div`
    display: flex;
    align-items: flex-start;
    gap: 0.55rem;
    padding: 0.6rem 0.75rem;
    border-radius: ${({ theme }) => theme.radii.sm};
    background: ${({ theme }) => theme.colors.primaryLight};
    font-size: 0.8125rem;
    color: ${({ theme }) => theme.colors.infoDark};

    svg {
        flex-shrink: 0;
        margin-top: 0.1rem;
    }

    strong {
        display: block;
        text-transform: capitalize;
    }

    span {
        font-size: 0.75rem;
        opacity: 0.85;
    }

    &.empty {
        background: ${({ theme }) => theme.colors.lightGray};
        color: ${({ theme }) => theme.colors.textMuted};
    }
`;

const Meters = styled.div`
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
`;

const Meter = styled.div`
    display: flex;
    flex-direction: column;
    gap: 0.25rem;

    .label {
        display: flex;
        justify-content: space-between;
        gap: 0.5rem;
        font-size: 0.75rem;
        color: ${({ theme }) => theme.colors.textMedium};

        strong {
            color: ${({ theme }) => theme.colors.textDark};
        }
    }
`;

const Footer = styled.footer`
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-top: auto;

    > * {
        flex: 1;
    }
`;

function NextSessionBox({ session, startDate }: { session: MyNextSession | null; startDate: string }) {
    if (!session) {
        return (
            <NextSession className="empty">
                <CalendarClock size={16} />
                <div>Sem aula agendada pela frente · início {formatDateOnly(startDate)}</div>
            </NextSession>
        );
    }
    const day = sessionTiming(session.date) === 'today' ? 'Hoje' : formatDateWithWeekday(session.date);
    return (
        <NextSession>
            <CalendarClock size={16} />
            <div>
                <strong>
                    {day}, {session.startTime}
                </strong>
                <span>{session.room ? session.room.name : 'Sala a definir'}</span>
            </div>
        </NextSession>
    );
}

function ProgressMeters({ progress }: { progress: MyCourseProgress | undefined }) {
    if (!progress) return null;
    const { attendance, lessons } = progress;
    return (
        <Meters>
            <Meter>
                <div className="label">
                    <span>Presença</span>
                    <strong>{attendance.percent}%</strong>
                </div>
                <MiniProgress $percent={attendance.percent} style={{ width: '100%' }} />
            </Meter>
            {lessons.total > 0 && (
                <Meter>
                    <div className="label">
                        <span>Vídeo-aulas</span>
                        <strong>
                            {lessons.completed} de {lessons.total}
                        </strong>
                    </div>
                    <MiniProgress $percent={(lessons.completed / lessons.total) * 100} style={{ width: '100%' }} />
                </Meter>
            )}
        </Meters>
    );
}

function CourseCards({
    courses,
    emptyMessage,
    progressById,
    onOpen,
}: {
    courses: MyCourse[];
    emptyMessage: string;
    /** Só as turmas em que a pessoa cursa têm progresso; instrutor não. */
    progressById?: Map<string, MyCourseProgress | undefined>;
    onOpen: (id: string, tab?: 'lessons') => void;
}) {
    if (courses.length === 0) return <EmptyState>{emptyMessage}</EmptyState>;
    return (
        <Grid>
            {courses.map((course) => (
                <CourseCard key={course.id}>
                    <header>
                        <div>
                            <h4>{course.event.title}</h4>
                            {course.category && <div className="category">{course.category}</div>}
                        </div>
                        <Badge $tone={STATUS_TONE[course.event.status]}>{STATUS_LABEL[course.event.status]}</Badge>
                    </header>
                    <NextSessionBox session={course.nextSession} startDate={course.event.startDate} />
                    {progressById && <ProgressMeters progress={progressById.get(course.id)} />}
                    <Footer>
                        <Button $variant={progressById ? 'secondary' : 'primary'} onClick={() => onOpen(course.id)}>
                            Abrir turma
                        </Button>
                        {progressById && (
                            <Button onClick={() => onOpen(course.id, 'lessons')}>
                                <PlayCircle size={15} /> Ir para as aulas
                            </Button>
                        )}
                    </Footer>
                </CourseCard>
            ))}
        </Grid>
    );
}

export default function MyCourses() {
    const navigate = useNavigate();
    const { data, isLoading } = useQuery({ queryKey: ['me', 'courses'], queryFn: () => meApi.getMyCourses() });

    const enrolled = data?.enrolled ?? [];
    // Mesma chave do MyProgress (dentro da turma): abrir a turma depois reaproveita o cache.
    const progressQueries = useQueries({
        queries: enrolled.map((course) => ({
            queryKey: ['me', 'courses', course.id, 'progress'],
            queryFn: () => meApi.getMyCourseProgress(course.id),
            retry: false,
        })),
    });
    const progressById = new Map(enrolled.map((course, index) => [course.id, progressQueries[index]?.data] as const));

    const openCourse = (id: string, tab?: 'lessons') => navigate(tab ? `/courses/${id}?tab=${tab}` : `/courses/${id}`);

    return (
        <PageLayout title="Minhas Turmas" subtitle="Turmas em que você é instrutor ou aluno matriculado" icon={<GraduationCap size={16} />}>
            {!isLoading && (data?.instructing.length ?? 0) > 0 && (
                <>
                    <SectionTitle>Leciono</SectionTitle>
                    <CourseCards courses={data?.instructing ?? []} emptyMessage="Nenhuma turma." onOpen={openCourse} />
                </>
            )}

            <SectionTitle>Matriculado</SectionTitle>
            {isLoading ? (
                <EmptyState>Carregando...</EmptyState>
            ) : (
                <CourseCards
                    courses={enrolled}
                    emptyMessage="Você ainda não está matriculado em nenhuma turma."
                    progressById={progressById}
                    onOpen={openCourse}
                />
            )}
        </PageLayout>
    );
}
