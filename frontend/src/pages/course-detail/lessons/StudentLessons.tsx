// frontend/src/pages/course-detail/lessons/StudentLessons.tsx
//
// Vídeo-aulas do ponto de vista do aluno, no formato de player de curso: a aula aberta ocupa a
// coluna principal (vídeo, texto e material) e a lista de módulos/aulas fica ao lado — embaixo,
// no celular. A aula aberta vai na URL (?aula=) para o link voltar exatamente onde o aluno parou.
//
// Progresso (regras no backend, course-lessons.service.ts): aula com vídeo enviado é marcada
// sozinha quando todos os vídeos enviados terminam; aula só com link/texto é o aluno quem marca.

import { useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import styled from 'styled-components';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Check, CheckCircle2, ChevronDown, Circle, FileText, Film, PlayCircle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/Table';
import { courseLessonsApi, courseModulesApi, type CourseLesson, type CourseModuleWithLessons } from '@/services/courses';
import { apiErrorMessage } from '@/utils/apiError';
import { toast } from '@/utils/toast';
import { MiniProgress } from '../styles';
import { LessonViewer } from './LessonViewer';
import { formatLessonDuration } from './lessonMedia';

const Layout = styled.div`
    display: grid;
    grid-template-columns: minmax(0, 1fr) 340px;
    gap: 1rem;
    align-items: start;

    @media (max-width: 1000px) {
        grid-template-columns: minmax(0, 1fr);
    }
`;

const Card = styled.div`
    background: ${({ theme }) => theme.colors.white};
    border: 1px solid ${({ theme }) => theme.colors.borderLight};
    border-radius: ${({ theme }) => theme.radii.md};
`;

const ProgressBar = styled(Card)`
    display: flex;
    align-items: center;
    gap: 1rem;
    flex-wrap: wrap;
    margin-bottom: 1rem;
    padding: 0.85rem 1.1rem;

    .summary {
        flex: 1;
        min-width: 220px;
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
    }

    strong {
        font-size: 0.9375rem;
        color: ${({ theme }) => theme.colors.textDark};
    }

    small {
        font-size: 0.75rem;
        color: ${({ theme }) => theme.colors.textMedium};
    }

    @media (max-width: 560px) {
        > button,
        > a {
            width: 100%;
        }
    }
`;

const LessonCard = styled(Card)`
    padding: 1.25rem 1.5rem 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    min-width: 0;
    scroll-margin-top: 0.5rem;

    @media (max-width: 640px) {
        padding: 1rem;
    }
`;

const LessonHeader = styled.header`
    display: flex;
    flex-direction: column;
    gap: 0.35rem;

    .eyebrow {
        font-size: 0.7rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: ${({ theme }) => theme.colors.primary};
    }

    h2 {
        margin: 0;
        font-size: 1.25rem;
        line-height: 1.3;
        overflow-wrap: anywhere;
    }

    .meta {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 0.4rem 0.9rem;
        font-size: 0.8125rem;
        color: ${({ theme }) => theme.colors.textMedium};

        span {
            display: inline-flex;
            align-items: center;
            gap: 0.3rem;
        }
    }

    .done {
        color: ${({ theme }) => theme.colors.success};
        font-weight: 600;
    }
`;

const Actions = styled.footer`
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 0.75rem;
    padding-top: 1rem;
    border-top: 1px solid ${({ theme }) => theme.colors.borderLight};

    .center {
        flex: 1;
        display: flex;
        justify-content: center;
        min-width: 0;
        text-align: center;
    }

    .hint {
        font-size: 0.75rem;
        color: ${({ theme }) => theme.colors.textMedium};
    }

    @media (max-width: 640px) {
        .center {
            order: -1;
            flex-basis: 100%;
        }

        > button,
        > a {
            flex: 1;
        }
    }
`;

const Aside = styled(Card)`
    position: sticky;
    top: 0.5rem;
    max-height: calc(100dvh - 2rem);
    overflow-y: auto;

    @media (max-width: 1000px) {
        position: static;
        max-height: none;
    }

    > h3 {
        margin: 0;
        padding: 0.9rem 1rem;
        font-size: 0.875rem;
        border-bottom: 1px solid ${({ theme }) => theme.colors.borderLight};
    }
`;

const ModuleToggle = styled.button<{ $open: boolean }>`
    display: flex;
    align-items: center;
    gap: 0.6rem;
    width: 100%;
    padding: 0.75rem 1rem;
    border: none;
    border-top: 1px solid ${({ theme }) => theme.colors.borderLight};
    background: ${({ theme }) => theme.colors.lightGray};
    text-align: left;
    cursor: pointer;
    color: ${({ theme }) => theme.colors.textDark};

    &:first-of-type {
        border-top: none;
    }

    .title {
        flex: 1;
        min-width: 0;
        font-size: 0.8125rem;
        font-weight: 700;
        overflow-wrap: anywhere;
    }

    .count {
        flex-shrink: 0;
        font-size: 0.7rem;
        font-weight: 700;
        color: ${({ theme }) => theme.colors.textMedium};
    }

    .count.all {
        color: ${({ theme }) => theme.colors.success};
    }

    .chevron {
        flex-shrink: 0;
        color: ${({ theme }) => theme.colors.textMuted};
        transform: rotate(${({ $open }) => ($open ? '0deg' : '-90deg')});
        transition: transform 0.15s ease;
    }
`;

const LessonRowButton = styled.button<{ $active: boolean }>`
    position: relative;
    display: flex;
    align-items: flex-start;
    gap: 0.65rem;
    width: 100%;
    padding: 0.65rem 1rem;
    border: none;
    border-top: 1px solid ${({ theme }) => theme.colors.borderLight};
    background: ${({ theme, $active }) => ($active ? theme.colors.primaryLight : theme.colors.white)};
    text-align: left;
    cursor: pointer;
    color: ${({ theme }) => theme.colors.textDark};

    &:hover {
        background: ${({ theme, $active }) => ($active ? theme.colors.primaryLight : theme.colors.lightGray)};
    }

    &::before {
        content: '';
        position: absolute;
        left: 0;
        top: 0;
        bottom: 0;
        width: 3px;
        background: ${({ theme, $active }) => ($active ? theme.colors.primary : 'transparent')};
    }

    .status {
        flex-shrink: 0;
        display: flex;
        margin-top: 0.1rem;
    }

    .text {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 0.2rem;
    }

    .name {
        font-size: 0.8125rem;
        font-weight: ${({ $active }) => ($active ? 700 : 500)};
        line-height: 1.35;
        overflow-wrap: anywhere;
    }

    .meta {
        display: flex;
        flex-wrap: wrap;
        gap: 0.1rem 0.6rem;
        font-size: 0.7rem;
        color: ${({ theme }) => theme.colors.textMuted};

        span {
            display: inline-flex;
            align-items: center;
            gap: 0.2rem;
        }
    }
`;

const COMPLETED_COLOR = '#28a745';
const PENDING_COLOR = '#adb5bd';

const isCompleted = (lesson: CourseLesson) => lesson.progress?.[0]?.completed ?? false;
const uploadedVideosOf = (lesson: CourseLesson) => (lesson.videos ?? []).filter((video) => video.storageKey);

export function StudentLessons({ courseId, lessonsRequired }: { courseId: string; lessonsRequired: boolean }) {
    const queryClient = useQueryClient();
    const [searchParams, setSearchParams] = useSearchParams();
    // Só guarda os módulos que o aluno abriu/fechou na mão; os demais seguem a aula aberta.
    const [openOverrides, setOpenOverrides] = useState<Record<string, boolean>>({});
    const stageRef = useRef<HTMLDivElement>(null);
    const initialLessonId = useRef<string | null>(null);

    const { data: modules, isLoading } = useQuery({ queryKey: ['courses', courseId, 'modules'], queryFn: () => courseModulesApi.list(courseId) });

    const refresh = () => {
        queryClient.invalidateQueries({ queryKey: ['courses', courseId, 'modules'] });
        // O resumo "Meu progresso" (e o certificado, que pode ter saído agora) dependem disto.
        queryClient.invalidateQueries({ queryKey: ['me'] });
    };

    const progressMutation = useMutation({
        mutationFn: ({ lessonId, completed }: { lessonId: string; completed: boolean }) => courseLessonsApi.markProgress(courseId, lessonId, completed),
        onSuccess: refresh,
        onError: (error: unknown) => toast.error(apiErrorMessage(error, 'Não foi possível salvar o progresso.')),
    });

    const videoWatchedMutation = useMutation({
        mutationFn: ({ lessonId, videoId }: { lessonId: string; videoId: string }) => courseLessonsApi.markVideoWatched(courseId, lessonId, videoId),
        onSuccess: refresh,
        onError: (error: unknown) => toast.error(apiErrorMessage(error, 'Não foi possível salvar o progresso.')),
    });

    const visibleModules: CourseModuleWithLessons[] = (modules ?? []).filter((courseModule) => courseModule.lessons.length > 0);
    const flat = visibleModules.flatMap((courseModule) => courseModule.lessons.map((lesson) => ({ lesson, module: courseModule })));

    if (isLoading) return <EmptyState>Carregando...</EmptyState>;
    if (flat.length === 0) return <EmptyState>Nenhuma vídeo-aula cadastrada nesta turma ainda.</EmptyState>;

    const completedCount = flat.filter((entry) => isCompleted(entry.lesson)).length;
    const percent = Math.round((completedCount / flat.length) * 100);
    const firstPending = flat.find((entry) => !isCompleted(entry.lesson));

    const requested = searchParams.get('aula');
    // Sem ?aula= (ou id inválido): abre a primeira aula que falta, não a primeira da lista. O
    // id fica guardado na primeira vez, senão a aula aberta "pularia" ao ser concluída.
    initialLessonId.current ??= (firstPending ?? flat[0]).lesson.id;
    const requestedIndex = flat.findIndex((entry) => entry.lesson.id === (requested ?? initialLessonId.current));
    const index = Math.max(0, requestedIndex);
    const current = flat[index];
    const previous = flat[index - 1];
    const next = flat[index + 1];

    const selectLesson = (lessonId: string) => {
        setSearchParams(
            (params) => {
                const updated = new URLSearchParams(params);
                updated.set('aula', lessonId);
                return updated;
            },
            { replace: true },
        );
        stageRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const moduleOpen = (moduleId: string) => openOverrides[moduleId] ?? moduleId === current.module.id;

    const uploaded = uploadedVideosOf(current.lesson);
    const watchedVideoIds = current.lesson.progress?.[0]?.watchedVideoIds ?? [];
    const watchedUploaded = uploaded.filter((video) => watchedVideoIds.includes(video.id)).length;
    const autoTracked = uploaded.length > 0;
    const completed = isCompleted(current.lesson);
    const duration = formatLessonDuration(current.lesson.duration);
    const videoCount = (current.lesson.videos ?? []).length;

    return (
        <div>
            <ProgressBar aria-label="Progresso nas vídeo-aulas">
                <div className="summary">
                    <strong>
                        {completedCount} de {flat.length} {flat.length === 1 ? 'aula assistida' : 'aulas assistidas'} · {percent}%
                    </strong>
                    <MiniProgress $percent={percent} style={{ width: '100%', height: 8 }} />
                    <small>{lessonsRequired ? 'Todas as vídeo-aulas são obrigatórias para o certificado.' : 'As vídeo-aulas são opcionais para o certificado.'}</small>
                </div>
                {firstPending ? (
                    <Button onClick={() => selectLesson(firstPending.lesson.id)}>
                        <PlayCircle size={16} /> {completedCount === 0 ? 'Começar' : 'Continuar de onde parei'}
                    </Button>
                ) : (
                    <Button as="span" $variant="secondary" style={{ cursor: 'default', color: COMPLETED_COLOR }}>
                        <CheckCircle2 size={16} /> Todas as aulas assistidas
                    </Button>
                )}
            </ProgressBar>

            <Layout>
                <LessonCard ref={stageRef}>
                    <LessonHeader>
                        <span className="eyebrow">{current.module.title}</span>
                        <h2>{current.lesson.title}</h2>
                        <div className="meta">
                            <span>
                                Aula {index + 1} de {flat.length}
                            </span>
                            {duration && <span>{duration}</span>}
                            {completed && (
                                <span className="done">
                                    <CheckCircle2 size={14} /> Assistida
                                </span>
                            )}
                        </div>
                    </LessonHeader>

                    <LessonViewer
                        key={current.lesson.id}
                        lesson={current.lesson}
                        watchedVideoIds={watchedVideoIds}
                        onVideoEnded={(videoId) => videoWatchedMutation.mutate({ lessonId: current.lesson.id, videoId })}
                    />

                    <Actions>
                        <Button $variant="secondary" disabled={!previous} onClick={() => previous && selectLesson(previous.lesson.id)}>
                            <ArrowLeft size={14} /> Anterior
                        </Button>

                        <div className="center">
                            {autoTracked ? (
                                <span className="hint">
                                    {completed
                                        ? 'Aula concluída.'
                                        : uploaded.length > 1
                                          ? `Marcada sozinha quando todos os vídeos terminarem (${watchedUploaded} de ${uploaded.length}).`
                                          : 'Marcada sozinha quando o vídeo terminar.'}
                                </span>
                            ) : completed ? (
                                <Button
                                    $variant="ghost"
                                    disabled={progressMutation.isPending}
                                    onClick={() => progressMutation.mutate({ lessonId: current.lesson.id, completed: false })}
                                >
                                    <RotateCcw size={14} /> Desmarcar como assistida
                                </Button>
                            ) : (
                                <Button
                                    $variant="secondary"
                                    disabled={progressMutation.isPending}
                                    onClick={() => progressMutation.mutate({ lessonId: current.lesson.id, completed: true })}
                                >
                                    <Check size={14} /> {videoCount > 0 ? 'Marcar como assistida' : 'Marcar como lida'}
                                </Button>
                            )}
                        </div>

                        <Button $variant={completed && next ? 'primary' : 'secondary'} disabled={!next} onClick={() => next && selectLesson(next.lesson.id)}>
                            Próxima <ArrowRight size={14} />
                        </Button>
                    </Actions>
                </LessonCard>

                <Aside as="nav" aria-label="Módulos e aulas">
                    <h3>Conteúdo do curso</h3>
                    {visibleModules.map((courseModule) => {
                        const open = moduleOpen(courseModule.id);
                        const done = courseModule.lessons.filter(isCompleted).length;
                        const contentId = `student-module-${courseModule.id}`;
                        return (
                            <div key={courseModule.id}>
                                <ModuleToggle
                                    type="button"
                                    $open={open}
                                    aria-expanded={open}
                                    aria-controls={contentId}
                                    onClick={() => setOpenOverrides((prev) => ({ ...prev, [courseModule.id]: !open }))}
                                >
                                    <ChevronDown className="chevron" size={16} />
                                    <span className="title">{courseModule.title}</span>
                                    <span className={`count${done === courseModule.lessons.length ? ' all' : ''}`}>
                                        {done}/{courseModule.lessons.length}
                                    </span>
                                </ModuleToggle>
                                <div id={contentId} hidden={!open}>
                                    {courseModule.lessons.map((lesson) => {
                                        const active = lesson.id === current.lesson.id;
                                        const lessonDone = isCompleted(lesson);
                                        const lessonDuration = formatLessonDuration(lesson.duration);
                                        const videos = (lesson.videos ?? []).length;
                                        const files = (lesson.files ?? []).length;
                                        return (
                                            <LessonRowButton key={lesson.id} type="button" $active={active} aria-current={active ? 'true' : undefined} onClick={() => selectLesson(lesson.id)}>
                                                <span className="status" aria-label={lessonDone ? 'Assistida' : active ? 'Aula aberta' : 'Não assistida'}>
                                                    {lessonDone ? (
                                                        <CheckCircle2 size={18} color={COMPLETED_COLOR} />
                                                    ) : active ? (
                                                        <PlayCircle size={18} color="#007BFF" />
                                                    ) : (
                                                        <Circle size={18} color={PENDING_COLOR} />
                                                    )}
                                                </span>
                                                <span className="text">
                                                    <span className="name">{lesson.title}</span>
                                                    {(lessonDuration || videos > 0 || files > 0) && (
                                                        <span className="meta">
                                                            {lessonDuration && <span>{lessonDuration}</span>}
                                                            {videos > 0 && (
                                                                <span>
                                                                    <Film size={11} /> {videos}
                                                                </span>
                                                            )}
                                                            {files > 0 && (
                                                                <span>
                                                                    <FileText size={11} /> {files}
                                                                </span>
                                                            )}
                                                        </span>
                                                    )}
                                                </span>
                                            </LessonRowButton>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </Aside>
            </Layout>
        </div>
    );
}
