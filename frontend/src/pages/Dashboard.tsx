// frontend/src/pages/Dashboard.tsx
//
// Fase 3 de posse de dado (docs/decisoes.md): painel "role-aware" — um
// usuário pode acumular papéis (decisão 8: ex-aluno que virou staff), então
// mostramos os blocos que fizerem sentido para ele, não um só. Cada bloco
// aponta para a página dedicada correspondente (/my-courses, etc.) em vez de
// duplicar a listagem aqui.

import { LayoutDashboard, GraduationCap, Award, ShieldCheck, Building2, CalendarClock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import styled from 'styled-components';
import { PageLayout } from '@/components/layout/PageLayout';
import { useAuth } from '@/contexts/AuthContext';
import { hasPermission } from '@/utils/permissions';
import { meApi } from '@/services/me';
import { coursesApi } from '@/services/courses';
import { eventsApi } from '@/services/events';
import { certificatesApi } from '@/services/certificates';
import { formatDateWithWeekday, sessionTiming } from '@/utils/courseDates';

const Grid = styled.div`
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    gap: 1rem;
`;

const Card = styled.div`
    background: ${({ theme }) => theme.colors.white};
    border-radius: ${({ theme }) => theme.radii.md};
    border: 1px solid ${({ theme }) => theme.colors.borderLight};
    padding: 1.25rem;
    cursor: pointer;
    transition: box-shadow 0.15s ease;

    &:hover {
        box-shadow: 0 4px 14px rgba(52, 58, 64, 0.1);
    }
`;

const CardHeader = styled.div`
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: ${({ theme }) => theme.colors.textMedium};
    font-size: 0.8125rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.02em;
    margin-bottom: 0.75rem;
`;

const Stat = styled.div`
    font-size: 1.75rem;
    font-weight: 700;
    color: ${({ theme }) => theme.colors.textDark};
`;

const StatLabel = styled.div`
    font-size: 0.8125rem;
    color: ${({ theme }) => theme.colors.textMuted};
    margin-top: 0.25rem;
`;

export default function Dashboard() {
    const navigate = useNavigate();
    const { user } = useAuth();

    const isStudent = !!user?.studentProfile;
    const isInstructor = (user?.instructorCourseIds?.length ?? 0) > 0;
    const isStaff = !!user?.staffMember;
    const canManageCourses = hasPermission(user, 'courses:manage');
    const canManageEvents = hasPermission(user, 'events:manage');
    const canManageCertificates = hasPermission(user, 'certificates:manage');
    const isAdmin = canManageCourses || canManageEvents || canManageCertificates;

    const { data: myCourses } = useQuery({
        queryKey: ['me', 'courses'],
        queryFn: () => meApi.getMyCourses(),
        enabled: isStudent || isInstructor,
    });
    const { data: myCertificates } = useQuery({
        queryKey: ['me', 'certificates'],
        queryFn: () => meApi.getMyCertificates(),
        enabled: isStudent,
    });
    const { data: myDesignations } = useQuery({
        queryKey: ['me', 'designations'],
        queryFn: () => meApi.getMyDesignations(),
        enabled: isStaff,
    });

    const { data: coursesOverview } = useQuery({
        queryKey: ['courses', { active: true }],
        queryFn: () => coursesApi.list(),
        enabled: canManageCourses,
    });
    const { data: eventsOverview } = useQuery({
        queryKey: ['events'],
        queryFn: () => eventsApi.list(),
        enabled: canManageEvents,
    });
    const { data: certificatesOverview } = useQuery({
        queryKey: ['certificates', { expiringInDays: 30 }],
        queryFn: () => certificatesApi.list({ expiringInDays: 30 }),
        enabled: canManageCertificates,
    });

    const pendingDesignations = (myDesignations ?? []).filter((d) => d.status === 'PENDING').length;
    // Antes contava todo certificado válido com data de validade, não só os que estão para vencer.
    const in30Days = Date.now() + 30 * 24 * 60 * 60 * 1000;
    const expiringSoon = (myCertificates ?? []).filter((c) => c.status === 'VALID' && c.expiresAt && new Date(c.expiresAt).getTime() <= in30Days).length;

    // Próxima aula entre todas as turmas da pessoa (cursando ou lecionando).
    const nextClass = [...(myCourses?.enrolled ?? []), ...(myCourses?.instructing ?? [])]
        .filter((course) => course.nextSession)
        .map((course) => ({ course, session: course.nextSession! }))
        .sort((a, b) => `${a.session.date}${a.session.startTime}`.localeCompare(`${b.session.date}${b.session.startTime}`))[0];

    const hasAnyPersonalRole = isStudent || isInstructor || isStaff;

    return (
        <PageLayout title="Painel" subtitle="Visão geral da academia" icon={<LayoutDashboard size={16} />}>
            {hasAnyPersonalRole && (
                <Grid>
                    {nextClass && (
                        <Card onClick={() => navigate(`/courses/${nextClass.course.id}`)}>
                            <CardHeader><CalendarClock size={16} /> Próxima aula</CardHeader>
                            <Stat style={{ fontSize: '1.25rem', textTransform: 'capitalize' }}>
                                {sessionTiming(nextClass.session.date) === 'today' ? 'Hoje' : formatDateWithWeekday(nextClass.session.date)}, {nextClass.session.startTime}
                            </Stat>
                            <StatLabel>
                                {nextClass.course.event.title} · {nextClass.session.room ? nextClass.session.room.name : 'sala a definir'}
                            </StatLabel>
                        </Card>
                    )}
                    {(isStudent || isInstructor) && (
                        <Card onClick={() => navigate('/my-courses')}>
                            <CardHeader><GraduationCap size={16} /> Minhas Turmas</CardHeader>
                            <Stat>{(myCourses?.instructing.length ?? 0) + (myCourses?.enrolled.length ?? 0)}</Stat>
                            <StatLabel>
                                {isInstructor && `${myCourses?.instructing.length ?? 0} lecionando`}
                                {isInstructor && isStudent && ' · '}
                                {isStudent && `${myCourses?.enrolled.length ?? 0} matriculado`}
                            </StatLabel>
                        </Card>
                    )}

                    {isStudent && (
                        <Card onClick={() => navigate('/my-certificates')}>
                            <CardHeader><Award size={16} /> Meus Certificados</CardHeader>
                            <Stat>{myCertificates?.length ?? 0}</Stat>
                            <StatLabel>{expiringSoon > 0 ? `${expiringSoon} vence(m) nos próximos 30 dias` : 'emitidos'}</StatLabel>
                        </Card>
                    )}

                    {isStaff && (
                        <Card onClick={() => navigate('/my-designations')}>
                            <CardHeader><ShieldCheck size={16} /> Minhas Designações</CardHeader>
                            <Stat>{myDesignations?.length ?? 0}</Stat>
                            <StatLabel>{pendingDesignations > 0 ? `${pendingDesignations} aguardando sua confirmação` : 'nenhuma pendente'}</StatLabel>
                        </Card>
                    )}
                </Grid>
            )}

            {isAdmin && (
                <>
                    <h3 style={{ margin: hasAnyPersonalRole ? '0.5rem 0 -0.5rem' : '0 0 -0.5rem' }}>Visão administrativa</h3>
                    <Grid>
                        {canManageCourses && (
                            <Card onClick={() => navigate('/courses')}>
                                <CardHeader><GraduationCap size={16} /> Turmas</CardHeader>
                                <Stat>{coursesOverview?.total ?? '—'}</Stat>
                                <StatLabel>na organização</StatLabel>
                            </Card>
                        )}
                        {canManageEvents && (
                            <Card onClick={() => navigate('/events')}>
                                <CardHeader><Building2 size={16} /> Eventos</CardHeader>
                                <Stat>{eventsOverview?.total ?? '—'}</Stat>
                                <StatLabel>agendados ou em andamento</StatLabel>
                            </Card>
                        )}
                        {canManageCertificates && (
                            <Card onClick={() => navigate('/certificates')}>
                                <CardHeader><Award size={16} /> Certificados a vencer</CardHeader>
                                <Stat>{certificatesOverview?.total ?? '—'}</Stat>
                                <StatLabel>nos próximos 30 dias</StatLabel>
                            </Card>
                        )}
                    </Grid>
                </>
            )}

            {!hasAnyPersonalRole && !isAdmin && (
                <Card style={{ cursor: 'default' }}>
                    <CardHeader>Bem-vindo(a)</CardHeader>
                    <StatLabel>Você ainda não está vinculado a nenhuma turma, evento ou equipe.</StatLabel>
                </Card>
            )}
        </PageLayout>
    );
}
