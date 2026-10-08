// frontend/src/pages/course-detail/MyProgress.tsx
//
// Visão do aluno no topo da turma: próxima aula (quando e em que sala), presença e vídeo-aulas
// em relação ao critério do certificado, e o certificado em si quando já emitido. Antes o aluno
// só sabia que "o certificado sai ao atingir a presença mínima", sem ver quanto já tinha.

import styled from 'styled-components';
import { useQuery } from '@tanstack/react-query';
import { CalendarClock, CheckCircle2, PlayCircle, Award, Download } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { meApi } from '@/services/me';
import { formatDateWithWeekday, sessionTiming } from '@/utils/courseDates';
import { MiniProgress } from './styles';
import type { ClassSession } from '@/types';

const Wrapper = styled.section`
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 0.75rem;
    margin-bottom: 1rem;

    /* Celular: presença e vídeo-aulas lado a lado; próxima aula e certificado em linha inteira. */
    @media (max-width: 640px) {
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 0.5rem;
    }
`;

const Card = styled.div<{ $highlight?: boolean; $wide?: boolean }>`
    background: ${({ theme, $highlight }) => ($highlight ? theme.colors.primaryLight : theme.colors.white)};
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

const Label = styled.div`
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    color: ${({ theme }) => theme.colors.textMuted};
`;

const Value = styled.div`
    font-size: 0.875rem;
    font-weight: 600;
    color: ${({ theme }) => theme.colors.textDark};
`;

const Hint = styled.div`
    font-size: 0.75rem;
    color: ${({ theme }) => theme.colors.textMedium};
`;

/**
 * Quantas presenças ainda faltam para bater o mínimo, considerando todas as aulas agendadas.
 * `remaining` = aulas em que a chamada dele ainda não foi lançada (inclui a de hoje).
 */
function attendanceHint(present: number, total: number, remaining: number, minPercent: number) {
    if (total === 0) return 'Nenhuma aula agendada ainda.';
    const needed = Math.max(0, Math.ceil((minPercent / 100) * total) - present);
    if (needed === 0) return `Você já atingiu a presença mínima de ${minPercent}%.`;
    if (needed > remaining) {
        return `Mínimo de ${minPercent}%. Com as aulas que restam não dá mais para atingir: fale com a coordenação.`;
    }
    return `Mínimo de ${minPercent}%: faltam ${needed} ${needed === 1 ? 'presença' : 'presenças'}.`;
}

export function MyProgress({ courseId, sessions }: { courseId: string; sessions: ClassSession[] }) {
    // 404 = não está matriculado (ex.: instrutor sem `courses:manage`); aí o bloco some.
    const { data: progress } = useQuery({ queryKey: ['me', 'courses', courseId, 'progress'], queryFn: () => meApi.getMyCourseProgress(courseId), retry: false });
    if (!progress) return null;

    const next = sessions.find((s) => sessionTiming(s.date) !== 'past');
    const { attendance, lessons, certificate } = progress;
    const remainingSessions = attendance.totalSessions - attendance.present - attendance.absent - attendance.justifiedAbsent;

    return (
        <Wrapper aria-label="Meu progresso na turma">
            <Card $highlight={!!next} $wide>
                <Label><CalendarClock size={13} /> Próxima aula</Label>
                {next ? (
                    <>
                        <Value>
                            <span style={{ textTransform: 'capitalize' }}>{sessionTiming(next.date) === 'today' ? 'Hoje' : formatDateWithWeekday(next.date)}</span>, {next.startTime} às {next.endTime}
                        </Value>
                        <Hint>{next.room ? `Sala: ${next.room.name}` : 'Sala ainda não definida'}{next.topic ? ` · ${next.topic}` : ''}</Hint>
                        {progress.group && <Hint>Seu grupo: {progress.group.name}. Veja a aba Programação para as atividades do dia.</Hint>}
                    </>
                ) : (
                    <Value>Nenhuma aula agendada pela frente</Value>
                )}
            </Card>

            <Card $wide={lessons.total === 0}>
                <Label><CheckCircle2 size={13} /> Minha presença</Label>
                <Value>
                    {attendance.present} de {attendance.totalSessions} {attendance.totalSessions === 1 ? 'aula' : 'aulas'} ({attendance.percent}%)
                </Value>
                <MiniProgress $percent={attendance.percent} style={{ width: '100%' }} />
                <Hint>{attendanceHint(attendance.present, attendance.totalSessions, remainingSessions, attendance.minPercent)}</Hint>
            </Card>

            {lessons.total > 0 && (
                <Card>
                    <Label><PlayCircle size={13} /> Vídeo-aulas</Label>
                    <Value>{lessons.completed} de {lessons.total} assistidas</Value>
                    <MiniProgress $percent={(lessons.completed / lessons.total) * 100} style={{ width: '100%' }} />
                    <Hint>{lessons.required ? 'Todas são obrigatórias para o certificado.' : 'Opcionais para o certificado.'}</Hint>
                </Card>
            )}

            <Card $wide>
                <Label><Award size={13} /> Certificado</Label>
                {certificate ? (
                    <>
                        <Value>{certificate.status === 'VALID' ? 'Emitido' : certificate.status === 'EXPIRED' ? 'Vencido' : 'Revogado'}</Value>
                        {certificate.pdfUrl && (
                            <Button as="a" href={certificate.pdfUrl} target="_blank" rel="noreferrer" $variant="secondary" style={{ alignSelf: 'flex-start' }}>
                                <Download size={14} /> Baixar PDF
                            </Button>
                        )}
                    </>
                ) : (
                    <>
                        <Value>Ainda não emitido</Value>
                        <Hint>
                            {attendance.upcomingSessions > 0
                                ? 'Sai automaticamente depois da última aula, se você cumprir os critérios.'
                                : 'Sai automaticamente quando você cumprir os critérios da turma.'}
                        </Hint>
                    </>
                )}
            </Card>
        </Wrapper>
    );
}
