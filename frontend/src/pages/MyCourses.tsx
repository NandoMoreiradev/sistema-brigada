// frontend/src/pages/MyCourses.tsx
//
// Fase 3 de posse de dado (docs/decisoes.md): "minhas turmas" — as que o
// usuário leciona (instrutor) e/ou cursa (aluno matriculado), via /me/courses.
// Diferente de Courses.tsx (lista completa da organização, agora restrita a
// quem tem `courses:manage`), esta tela é para quem não administra turmas.

import { GraduationCap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { PageLayout } from '@/components/layout/PageLayout';
import { Table, TableWrapper, Thead, Tr, Th, Td, EmptyState, Badge } from '@/components/ui/Table';
import { meApi, type MyCourse } from '@/services/me';
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

function CourseTable({ courses, emptyMessage, onOpen }: { courses: MyCourse[]; emptyMessage: string; onOpen: (id: string) => void }) {
    return (
        <TableWrapper>
            <Table>
                <Thead>
                    <tr>
                        <Th>Turma</Th>
                        <Th>Início</Th>
                        <Th>Status</Th>
                        <Th></Th>
                    </tr>
                </Thead>
                <tbody>
                    {courses.map((course) => (
                        <Tr key={course.id} onClick={() => onOpen(course.id)} style={{ cursor: 'pointer' }}>
                            <Td>{course.event.title}</Td>
                            <Td>{format(new Date(course.event.startDate), 'dd/MM/yyyy')}</Td>
                            <Td><Badge $tone={STATUS_TONE[course.event.status]}>{STATUS_LABEL[course.event.status]}</Badge></Td>
                            <Td></Td>
                        </Tr>
                    ))}
                </tbody>
            </Table>
            {courses.length === 0 && <EmptyState>{emptyMessage}</EmptyState>}
        </TableWrapper>
    );
}

export default function MyCourses() {
    const navigate = useNavigate();
    const { data, isLoading } = useQuery({ queryKey: ['me', 'courses'], queryFn: () => meApi.getMyCourses() });

    const openCourse = (id: string) => navigate(`/courses/${id}`);

    return (
        <PageLayout title="Minhas Turmas" subtitle="Turmas em que você é instrutor ou aluno matriculado" icon={<GraduationCap size={16} />}>
            {!isLoading && (data?.instructing.length ?? 0) > 0 && (
                <>
                    <h3 style={{ margin: '0 0 -0.5rem' }}>Leciono</h3>
                    <CourseTable courses={data?.instructing ?? []} emptyMessage="Nenhuma turma." onOpen={openCourse} />
                </>
            )}

            <h3 style={{ margin: '0 0 -0.5rem' }}>Matriculado</h3>
            <CourseTable
                courses={data?.enrolled ?? []}
                emptyMessage="Você ainda não está matriculado em nenhuma turma."
                onOpen={openCourse}
            />
        </PageLayout>
    );
}
