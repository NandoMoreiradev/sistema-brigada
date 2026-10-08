// frontend/src/pages/course-detail/CourseSummary.tsx
//
// Cabeçalho da turma: cartões com o que o professor consulta o tempo todo (quando/onde,
// lotação, instrutores, regra do certificado), no lugar da linha única com 7 itens.

import { useState } from 'react';
import styled from 'styled-components';
import { CalendarDays, MapPin, Users, Award } from 'lucide-react';
import { Badge } from '@/components/ui/Table';
import { formatDateOnly } from '@/utils/courseDates';
import { MiniProgress } from './styles';
import type { Course, EventStatus } from '@/types';

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

const Grid = styled.div`
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(185px, 1fr));
    gap: 0.75rem;
    margin-bottom: 1rem;

    /* Celular: duas colunas, para o resumo não empurrar as abas para fora da tela. */
    @media (max-width: 640px) {
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 0.5rem;
    }
`;

const Card = styled.div<{ $wide?: boolean }>`
    background: ${({ theme }) => theme.colors.white};
    border: 1px solid ${({ theme }) => theme.colors.borderLight};
    border-radius: ${({ theme }) => theme.radii.md};
    padding: 0.75rem 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    min-width: 0;

    @media (max-width: 640px) {
        padding: 0.6rem 0.75rem;
        ${({ $wide }) => $wide && 'grid-column: 1 / -1;'}
    }
`;

const CardLabel = styled.div`
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    color: ${({ theme }) => theme.colors.textMuted};
`;

const CardValue = styled.div`
    font-size: 0.875rem;
    font-weight: 600;
    color: ${({ theme }) => theme.colors.textDark};
    overflow-wrap: anywhere;
`;

const CardHint = styled.div`
    font-size: 0.75rem;
    color: ${({ theme }) => theme.colors.textMedium};
`;

const Chips = styled.div`
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
`;

const InstructorChip = styled.span`
    padding: 0.15rem 0.55rem;
    border-radius: ${({ theme }) => theme.radii.pill};
    background: ${({ theme }) => theme.colors.primaryLight};
    color: ${({ theme }) => theme.colors.infoDark};
    font-size: 0.75rem;
    font-weight: 600;
`;

const MoreChip = styled.button`
    padding: 0.15rem 0.55rem;
    border-radius: ${({ theme }) => theme.radii.pill};
    border: 1px dashed ${({ theme }) => theme.colors.borderLight};
    background: transparent;
    color: ${({ theme }) => theme.colors.textMedium};
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;

    &:hover {
        color: ${({ theme }) => theme.colors.textDark};
    }
`;

// Turmas com muitos instrutores (ex.: a equipe toda) esticavam a linha de cartões inteira.
// Também usado na listagem de turmas (Courses.tsx), onde a coluna ocupava a tabela toda.
const VISIBLE_INSTRUCTORS = 3;

export function InstructorList({ instructors }: { instructors: Course['instructors'] }) {
    const [expanded, setExpanded] = useState(false);
    const hidden = instructors.length - VISIBLE_INSTRUCTORS;
    const visible = expanded || hidden <= 0 ? instructors : instructors.slice(0, VISIBLE_INSTRUCTORS);

    return (
        <Chips>
            {visible.map((instructor) => (
                <InstructorChip key={instructor.userId}>{instructor.user.name}</InstructorChip>
            ))}
            {hidden > 0 && (
                <MoreChip
                    type="button"
                    onClick={(e) => {
                        // Na listagem a linha inteira é clicável (abre a turma).
                        e.stopPropagation();
                        setExpanded((v) => !v);
                    }}
                    title={expanded ? undefined : instructors.slice(VISIBLE_INSTRUCTORS).map((i) => i.user.name).join('\n')}
                >
                    {expanded ? 'Mostrar menos' : `+${hidden}`}
                </MoreChip>
            )}
        </Chips>
    );
}

export function CourseSummary({ course, studentView = false }: { course: Course; studentView?: boolean }) {
    const start = formatDateOnly(course.event.startDate);
    const end = course.event.endDate ? formatDateOnly(course.event.endDate) : null;
    const enrolled = course._count.enrollments;
    const percentFull = course.vacancies ? Math.round((enrolled / course.vacancies) * 100) : 0;

    return (
        <Grid>
            <Card>
                <CardLabel><CalendarDays size={13} /> Período</CardLabel>
                <CardValue>{end && end !== start ? `${start} a ${end}` : start}</CardValue>
                <Badge $tone={STATUS_TONE[course.event.status]} style={{ alignSelf: 'flex-start' }}>{STATUS_LABEL[course.event.status]}</Badge>
            </Card>

            {/* Para a equipe o "Não informado" lembra de preencher; para o aluno é só ruído. */}
            {(!studentView || course.event.location || course.defaultRoom) && (
                <Card>
                    <CardLabel><MapPin size={13} /> Local</CardLabel>
                    {!course.event.location && studentView && course.defaultRoom ? (
                        <CardValue>{course.defaultRoom.name}</CardValue>
                    ) : (
                        <>
                            <CardValue>{course.event.location || 'Não informado'}</CardValue>
                            {course.defaultRoom && <CardHint>Sala padrão: {course.defaultRoom.name}</CardHint>}
                        </>
                    )}
                </Card>
            )}

            {/* Lotação e regra do certificado são da gestão; o aluno vê o próprio andamento em "Meu progresso". */}
            {!studentView && (
                <Card>
                    <CardLabel><Users size={13} /> Matrículas</CardLabel>
                    <CardValue>
                        {enrolled}
                        {course.vacancies ? ` de ${course.vacancies} vagas` : ' matriculados'}
                    </CardValue>
                    {course.vacancies ? <MiniProgress $percent={percentFull} style={{ width: '100%' }} /> : <CardHint>Sem limite de vagas</CardHint>}
                </Card>
            )}

            <Card>
                <CardLabel>
                    <Users size={13} /> Instrutores{course.instructors.length > VISIBLE_INSTRUCTORS ? ` (${course.instructors.length})` : ''}
                </CardLabel>
                {course.instructors.length > 0 ? (
                    <InstructorList instructors={course.instructors} />
                ) : (
                    <CardValue>Nenhum definido</CardValue>
                )}
            </Card>

            <Card $wide>
                <CardLabel><Award size={13} /> {studentView ? 'Regra do certificado' : 'Certificado'}</CardLabel>
                <CardValue>Presença mínima de {course.minAttendancePercent}%</CardValue>
                <CardHint>
                    {course.requireAllLessonsWatched ? 'Todas as vídeo-aulas obrigatórias' : 'Vídeo-aulas opcionais'} ·{' '}
                    {course.recyclingValidityMonths ? `validade de ${course.recyclingValidityMonths} meses` : 'sem vencimento'}
                </CardHint>
            </Card>
        </Grid>
    );
}
