// frontend/src/pages/course-detail/CopyFromCourseModal.tsx
//
// Copia agenda, programação e vídeo-aulas de uma turma já feita para esta (ver
// backend/src/courses/course-copy.service.ts). Alunos, chamadas e progresso não vão junto.

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Field, Label, Input, Select, HelpText, ErrorText, Form, FormActions, CheckboxField } from '@/components/ui/FormField';
import { coursesApi, type CourseCopyResult } from '@/services/courses';
import { toast } from '@/utils/toast';
import { apiErrorMessage } from '@/utils/apiError';
import { formatDateOnly } from '@/utils/courseDates';
import { Muted } from './styles';

interface Props {
    courseId: string;
    /** Primeiro dia desta turma (`yyyy-MM-dd`): sugestão para o início do conteúdo copiado. */
    defaultDate: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

const plural = (count: number, singular: string, pluralForm: string) => `${count} ${count === 1 ? singular : pluralForm}`;

function summarize(result: CourseCopyResult) {
    const parts: string[] = [];
    if (result.sessions.copied) parts.push(plural(result.sessions.copied, 'aula na agenda', 'aulas na agenda'));
    if (result.schedule.activities) parts.push(`programação (${plural(result.schedule.activities, 'atividade', 'atividades')})`);
    if (result.lessons.modules) parts.push(`${plural(result.lessons.modules, 'módulo', 'módulos')} de vídeo-aulas`);
    return parts.length ? `Copiado: ${parts.join(', ')}.` : 'Nada para copiar com as opções escolhidas.';
}

export function CopyFromCourseModal({ courseId, defaultDate, open, onOpenChange }: Props) {
    const queryClient = useQueryClient();
    const [sourceId, setSourceId] = useState('');
    const [sessions, setSessions] = useState(true);
    const [schedule, setSchedule] = useState(true);
    const [lessons, setLessons] = useState(true);
    const [startDate, setStartDate] = useState(defaultDate);
    const [result, setResult] = useState<CourseCopyResult | null>(null);

    useEffect(() => {
        if (!open) return;
        setSourceId('');
        setStartDate(defaultDate);
        setResult(null);
    }, [open, defaultDate]);

    const { data: courses } = useQuery({ queryKey: ['courses', 'copy-sources'], queryFn: () => coursesApi.list(), enabled: open });
    const sources = (courses?.data ?? []).filter((c) => c.id !== courseId).sort((a, b) => b.event.startDate.localeCompare(a.event.startDate));

    const { data: preview, isFetching: loadingPreview } = useQuery({
        queryKey: ['courses', courseId, 'copy-preview', sourceId],
        queryFn: () => coursesApi.copyPreview(courseId, sourceId),
        enabled: open && Boolean(sourceId),
    });

    const source = preview?.source;
    const target = preview?.target;
    const hasSessions = (source?.sessions ?? 0) > 0;
    const hasSchedule = (source?.activities ?? 0) > 0;
    const hasLessons = (source?.modules ?? 0) > 0;
    // A programação só entra em turma sem atividades (para não misturar duas programações).
    const scheduleBlocked = hasSchedule && (target?.activities ?? 0) > 0;

    // Ao escolher a origem, já marca só o que ela tem para copiar.
    useEffect(() => {
        if (!source) return;
        setSessions(hasSessions);
        setSchedule(hasSchedule && !scheduleBlocked);
        setLessons(hasLessons);
    }, [source, hasSessions, hasSchedule, hasLessons, scheduleBlocked]);

    const doSessions = sessions && hasSessions;
    const doSchedule = schedule && hasSchedule && !scheduleBlocked;
    const doLessons = lessons && hasLessons;
    const needsDate = (doSessions || doSchedule) && Boolean(source?.firstDate);

    const copyMutation = useMutation({
        mutationFn: () =>
            coursesApi.copyFrom(courseId, {
                sourceCourseId: sourceId,
                startDate: needsDate ? startDate : undefined,
                sessions: doSessions,
                schedule: doSchedule,
                lessons: doLessons,
            }),
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['courses', courseId] });
            toast.success(summarize(data));
            if (data.warnings.length > 0) setResult(data);
            else onOpenChange(false);
        },
        onError: (error: unknown) => toast.error(apiErrorMessage(error, 'Não foi possível copiar o conteúdo.')),
    });

    const canSubmit = Boolean(source) && (doSessions || doSchedule || doLessons) && (!needsDate || Boolean(startDate)) && !copyMutation.isPending;

    if (result) {
        return (
            <Modal open={open} onOpenChange={onOpenChange} title="Conteúdo copiado">
                <Form onSubmit={(e) => { e.preventDefault(); onOpenChange(false); }}>
                    <HelpText>{summarize(result)} Confira estes pontos:</HelpText>
                    <ul style={{ margin: 0, paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.8125rem' }}>
                        {result.warnings.map((warning) => (
                            <li key={warning}>{warning}</li>
                        ))}
                    </ul>
                    <FormActions>
                        <Button type="submit">Fechar</Button>
                    </FormActions>
                </Form>
            </Modal>
        );
    }

    return (
        <Modal open={open} onOpenChange={onOpenChange} title="Copiar de outra turma">
            <Form onSubmit={(e) => { e.preventDefault(); if (canSubmit) copyMutation.mutate(); }}>
                <HelpText>Aproveite o que já foi montado numa turma anterior. Alunos, chamadas, diários e progresso não são copiados.</HelpText>
                <Field>
                    <Label htmlFor="copySource">Copiar da turma</Label>
                    <Select id="copySource" value={sourceId} onChange={(e) => setSourceId(e.target.value)}>
                        <option value="">Escolha uma turma</option>
                        {sources.map((c) => (
                            <option key={c.id} value={c.id}>{c.event.title} — {formatDateOnly(c.event.startDate)}</option>
                        ))}
                    </Select>
                    {courses && sources.length === 0 && <Muted>Não há outra turma para copiar.</Muted>}
                </Field>

                {sourceId && loadingPreview && <Muted>Carregando...</Muted>}

                {source && target && (
                    <>
                        <Field>
                            <Label>O que copiar</Label>
                            <CheckboxField>
                                <input type="checkbox" checked={doSessions} disabled={!hasSessions} onChange={(e) => setSessions(e.target.checked)} />
                                <span>
                                    Agenda — {hasSessions ? plural(source.sessions, 'aula avulsa', 'aulas avulsas') : 'nenhuma aula avulsa na turma de origem'}
                                    {hasSessions && target.sessions > 0 && <Muted> (esta turma já tem {plural(target.sessions, 'aula', 'aulas')}; as copiadas entram junto)</Muted>}
                                </span>
                            </CheckboxField>
                            <CheckboxField>
                                <input type="checkbox" checked={doSchedule} disabled={!hasSchedule || scheduleBlocked} onChange={(e) => setSchedule(e.target.checked)} />
                                <span>
                                    Programação — {hasSchedule ? `${plural(source.groups, 'grupo', 'grupos')}, ${plural(source.activities, 'atividade', 'atividades')}, ${plural(source.scheduleDays, 'dia', 'dias')}` : 'sem atividades na turma de origem'}
                                    {scheduleBlocked && <Muted> (esta turma já tem atividades; a programação só é copiada para uma turma sem atividades)</Muted>}
                                </span>
                            </CheckboxField>
                            <CheckboxField>
                                <input type="checkbox" checked={doLessons} disabled={!hasLessons} onChange={(e) => setLessons(e.target.checked)} />
                                <span>
                                    Vídeo-aulas — {hasLessons ? `${plural(source.modules, 'módulo', 'módulos')}, ${plural(source.lessons, 'aula', 'aulas')}, ${plural(source.videos, 'vídeo', 'vídeos')}, ${plural(source.files, 'material', 'materiais')}` : 'nenhum módulo na turma de origem'}
                                    {hasLessons && target.modules > 0 && <Muted> (esta turma já tem {plural(target.modules, 'módulo', 'módulos')}; os copiados entram depois)</Muted>}
                                </span>
                            </CheckboxField>
                        </Field>

                        {needsDate && (
                            <Field>
                                <Label htmlFor="copyStartDate">Primeiro dia nesta turma</Label>
                                <Input id="copyStartDate" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                                <Muted>
                                    {source.firstDate && `Na turma de origem o primeiro dia foi ${formatDateOnly(source.firstDate)}. `}
                                    As demais datas seguem o mesmo intervalo a partir deste dia.
                                </Muted>
                            </Field>
                        )}
                        {!doSessions && !doSchedule && !doLessons && <ErrorText>Não há nada para copiar com as opções atuais.</ErrorText>}
                        {doLessons && (
                            <HelpText>Os vídeos e materiais enviados não são duplicados: as duas turmas usam o mesmo arquivo.</HelpText>
                        )}
                        {doSchedule && <HelpText>Salas, equipes ou pessoas desativadas ficam de fora; quem é responsável por uma atividade vira instrutor desta turma.</HelpText>}
                    </>
                )}

                <FormActions>
                    <Button type="button" $variant="secondary" onClick={() => onOpenChange(false)}>Cancelar</Button>
                    <Button type="submit" disabled={!canSubmit}>{copyMutation.isPending ? 'Copiando...' : 'Copiar'}</Button>
                </FormActions>
            </Form>
        </Modal>
    );
}
