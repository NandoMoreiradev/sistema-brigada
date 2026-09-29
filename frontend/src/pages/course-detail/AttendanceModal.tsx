// frontend/src/pages/course-detail/AttendanceModal.tsx
//
// Chamada + diário de uma aula. Feita para o professor lançar a turma inteira rápido:
// um toque por aluno (em vez de abrir um dropdown por linha), "Todos presentes" e contadores.
// Só as linhas alteradas ficam em `draft`; o botão de salvar reflete se há algo pendente.

import { useState } from 'react';
import styled from 'styled-components';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, X, FileText, CheckCheck } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Field, Label, Textarea, Form, FormActions, HelpText } from '@/components/ui/FormField';
import { EmptyState } from '@/components/ui/Table';
import { classSessionsApi } from '@/services/courses';
import { toast } from '@/utils/toast';
import { apiErrorMessage } from '@/utils/apiError';
import { formatDateWithWeekday } from '@/utils/courseDates';
import type { AttendanceStatus } from '@/types';

type Choice = { value: AttendanceStatus; label: string; short: string; icon: React.ReactNode; color: string; bg: string };

const CHOICES: Choice[] = [
    { value: 'PRESENT', label: 'Presente', short: 'Presente', icon: <Check size={14} />, color: '#1b7a34', bg: '#e6f7ec' },
    { value: 'ABSENT', label: 'Ausente', short: 'Falta', icon: <X size={14} />, color: '#c92a2a', bg: '#fdecea' },
    { value: 'JUSTIFIED_ABSENT', label: 'Falta justificada', short: 'Justificada', icon: <FileText size={14} />, color: '#8a6d00', bg: '#fff8e1' },
];

const Summary = styled.div`
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem 1rem;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.75rem;
`;

const Counters = styled.div`
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    font-size: 0.75rem;
    font-weight: 600;

    span {
        padding: 0.2rem 0.6rem;
        border-radius: ${({ theme }) => theme.radii.pill};
        background: ${({ theme }) => theme.colors.lightGray};
        color: ${({ theme }) => theme.colors.textMedium};
    }
`;

const Roster = styled.div`
    border: 1px solid ${({ theme }) => theme.colors.borderLight};
    border-radius: ${({ theme }) => theme.radii.md};
    max-height: min(46vh, 420px);
    overflow-y: auto;
`;

const RosterRow = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    flex-wrap: wrap;
    padding: 0.5rem 0.75rem;
    border-top: 1px solid ${({ theme }) => theme.colors.borderLight};
    font-size: 0.8125rem;

    &:first-child {
        border-top: none;
    }
`;

const Segmented = styled.div`
    display: inline-flex;
    gap: 0.25rem;
`;

const Segment = styled.button<{ $active: boolean; $color: string; $bg: string }>`
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.3rem 0.6rem;
    border-radius: ${({ theme }) => theme.radii.sm};
    border: 1px solid ${({ $active, $color, theme }) => ($active ? $color : theme.colors.border)};
    background: ${({ $active, $bg, theme }) => ($active ? $bg : theme.colors.white)};
    color: ${({ $active, $color, theme }) => ($active ? $color : theme.colors.textMedium)};
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;

    &:hover {
        border-color: ${({ $color }) => $color};
    }
`;

const Dirty = styled.span`
    font-size: 0.75rem;
    font-weight: 600;
    color: #b8860b;
`;

interface AttendanceModalProps {
    courseId: string;
    session: { id: string; date: string; classLog?: { content: string } | null };
    onClose: () => void;
}

export function AttendanceModal({ courseId, session, onClose }: AttendanceModalProps) {
    const queryClient = useQueryClient();
    const [draft, setDraft] = useState<Record<string, AttendanceStatus | null>>({});
    const [logContent, setLogContent] = useState(session.classLog?.content ?? '');
    const savedLog = session.classLog?.content ?? '';

    const { data: roster, isLoading } = useQuery({
        queryKey: ['courses', courseId, 'sessions', session.id, 'attendance'],
        queryFn: () => classSessionsApi.getAttendance(courseId, session.id),
    });

    const entries = roster ?? [];
    const statusOf = (enrollmentId: string, fallback: AttendanceStatus | null) =>
        enrollmentId in draft ? draft[enrollmentId] : fallback;

    const counts = entries.reduce(
        (acc, entry) => {
            const status = statusOf(entry.enrollmentId, entry.status);
            acc[status ?? 'NONE'] += 1;
            return acc;
        },
        { PRESENT: 0, ABSENT: 0, JUSTIFIED_ABSENT: 0, NONE: 0 } as Record<AttendanceStatus | 'NONE', number>,
    );

    const attendanceDirty = Object.keys(draft).length > 0;
    const logDirty = logContent !== savedLog;

    const markAttendanceMutation = useMutation({
        mutationFn: (records: { enrollmentId: string; status: AttendanceStatus }[]) =>
            classSessionsApi.markAttendance(courseId, session.id, records),
        onSuccess: async () => {
            toast.success('Presença registrada com sucesso.');
            queryClient.invalidateQueries({ queryKey: ['courses', courseId, 'sessions'] });
            await queryClient.invalidateQueries({ queryKey: ['courses', courseId, 'sessions', session.id, 'attendance'] });
            setDraft({});
        },
        onError: (error: unknown) => toast.error(apiErrorMessage(error, 'Não foi possível salvar a presença.')),
    });

    const upsertLogMutation = useMutation({
        mutationFn: (content: string) => classSessionsApi.upsertLog(courseId, session.id, content),
        onSuccess: () => {
            toast.success('Diário de aula salvo.');
            queryClient.invalidateQueries({ queryKey: ['courses', courseId, 'sessions'] });
        },
        onError: (error: unknown) => toast.error(apiErrorMessage(error, 'Não foi possível salvar o diário de aula.')),
    });

    const setStatus = (enrollmentId: string, serverStatus: AttendanceStatus | null, next: AttendanceStatus | null) => {
        setDraft((prev) => {
            const copy = { ...prev };
            // Voltar ao valor já salvo remove a linha do rascunho (não conta como alteração).
            if (next === serverStatus) delete copy[enrollmentId];
            else copy[enrollmentId] = next;
            return copy;
        });
    };

    const markAllPresent = () => {
        const next: Record<string, AttendanceStatus | null> = {};
        entries.forEach((entry) => {
            if (entry.status !== 'PRESENT') next[entry.enrollmentId] = 'PRESENT';
        });
        setDraft(next);
    };

    const handleSaveAttendance = () => {
        const records = entries
            .map((entry) => ({ enrollmentId: entry.enrollmentId, status: statusOf(entry.enrollmentId, entry.status) }))
            .filter((r): r is { enrollmentId: string; status: AttendanceStatus } => r.status !== null);
        markAttendanceMutation.mutate(records);
    };

    const requestClose = () => {
        if ((attendanceDirty || logDirty) && !window.confirm('Há alterações não salvas nesta aula. Fechar mesmo assim?')) return;
        onClose();
    };

    return (
        <Modal open onOpenChange={(open) => !open && requestClose()} title={`Chamada — ${formatDateWithWeekday(session.date)}`} width="680px">
            {isLoading ? (
                <EmptyState>Carregando...</EmptyState>
            ) : (
                <>
                    <Summary>
                        <Counters aria-live="polite">
                            <span style={{ background: '#e6f7ec', color: '#1b7a34' }}>{counts.PRESENT} presentes</span>
                            <span style={{ background: '#fdecea', color: '#c92a2a' }}>{counts.ABSENT} faltas</span>
                            <span style={{ background: '#fff8e1', color: '#8a6d00' }}>{counts.JUSTIFIED_ABSENT} justificadas</span>
                            <span>{counts.NONE} sem lançamento</span>
                        </Counters>
                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                            <Button $variant="secondary" onClick={markAllPresent} disabled={entries.length === 0}>
                                <CheckCheck size={14} /> Todos presentes
                            </Button>
                        </div>
                    </Summary>

                    {entries.length === 0 ? (
                        <EmptyState>Nenhum aluno matriculado nesta turma ainda.</EmptyState>
                    ) : (
                        <Roster>
                            {entries.map((entry) => {
                                const current = statusOf(entry.enrollmentId, entry.status);
                                return (
                                    <RosterRow key={entry.enrollmentId}>
                                        <strong style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{entry.student.name}</strong>
                                        <Segmented role="group" aria-label={`Presença de ${entry.student.name}`}>
                                            {CHOICES.map((choice) => (
                                                <Segment
                                                    key={choice.value}
                                                    type="button"
                                                    $active={current === choice.value}
                                                    $color={choice.color}
                                                    $bg={choice.bg}
                                                    aria-pressed={current === choice.value}
                                                    title={choice.label}
                                                    onClick={() => setStatus(entry.enrollmentId, entry.status, current === choice.value ? entry.status : choice.value)}
                                                >
                                                    {choice.icon} {choice.short}
                                                </Segment>
                                            ))}
                                        </Segmented>
                                    </RosterRow>
                                );
                            })}
                        </Roster>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '0.75rem', margin: '0.75rem 0 1.25rem' }}>
                        {attendanceDirty && <Dirty>Alterações não salvas</Dirty>}
                        <Button onClick={handleSaveAttendance} disabled={!attendanceDirty || markAttendanceMutation.isPending}>
                            {markAttendanceMutation.isPending ? 'Salvando...' : 'Salvar presença'}
                        </Button>
                    </div>

                    <Form onSubmit={(e) => { e.preventDefault(); upsertLogMutation.mutate(logContent); }}>
                        <Field>
                            <Label htmlFor="classLog">Diário de aula</Label>
                            <Textarea
                                id="classLog"
                                rows={5}
                                placeholder="Conteúdo abordado, ocorrências, tarefas para a próxima aula..."
                                value={logContent}
                                onChange={(e) => setLogContent(e.target.value)}
                            />
                            <HelpText>Fica registrado na turma e visível para a coordenação.</HelpText>
                        </Field>
                        <FormActions>
                            <Button type="button" $variant="secondary" onClick={requestClose}>Fechar</Button>
                            <Button type="submit" disabled={!logContent.trim() || !logDirty || upsertLogMutation.isPending}>
                                {upsertLogMutation.isPending ? 'Salvando...' : 'Salvar diário'}
                            </Button>
                        </FormActions>
                    </Form>
                </>
            )}
        </Modal>
    );
}
