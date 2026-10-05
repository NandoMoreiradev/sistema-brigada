// frontend/src/pages/course-detail/LessonsTab.tsx
//
// Módulos + aulas em vídeo de uma turma (decisão de reaproveitamento em docs/decisoes.md:
// TrainingModule/Lesson/Progress do maskotCrmEdu, agora escopado por Course).

import { useState } from 'react';
import styled from 'styled-components';
import { Plus, PlayCircle, CheckCircle2, Circle, Trash2, Pencil, UserCog } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Field, Label, Input, Select, HelpText, Form, FormActions } from '@/components/ui/FormField';
import { FilterChip } from './styles';
import { TableWrapper, EmptyState } from '@/components/ui/Table';
import { courseModulesApi, courseLessonsApi, type CourseLesson, type CourseLessonInput, type CourseModuleWithLessons } from '@/services/courses';
import { mediaApi } from '@/services/media';
import { toast } from '@/utils/toast';
import { apiErrorMessage } from '@/utils/apiError';
import { RichTextEditor } from '@/components/ui/RichTextEditor';
import { RichTextViewer } from '@/components/ui/RichTextViewer';

const VIDEO_ALLOWED_TYPES = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-matroska'];
const VIDEO_MAX_SIZE = 500 * 1024 * 1024; // 500MB — mesmo teto do contexto 'course-lessons' em media.service.ts

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
        display: flex;
        align-items: baseline;
        gap: 0.5rem;
    }

    small {
        font-size: 0.7rem;
        font-weight: 600;
        color: ${({ theme }) => theme.colors.textMuted};
    }
`;

const ResponsibleLine = styled.div`
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.35rem;
    margin-bottom: 0.5rem;
    font-size: 0.75rem;
    color: ${({ theme }) => theme.colors.textMuted};

    span {
        padding: 0.1rem 0.5rem;
        border-radius: ${({ theme }) => theme.radii.pill};
        background: ${({ theme }) => theme.colors.primaryLight};
        color: ${({ theme }) => theme.colors.infoDark};
        font-weight: 600;
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
 *
 * Progresso do aluno: vídeo próprio é marcado como assistido sozinho quando chega ao fim (o aluno
 * não marca à mão). Link externo não tem como ser acompanhado, então continua sendo o aluno quem
 * marca. Marcar assistida pode liberar o certificado (course-lessons.service.ts).
 */
export function LessonsTab({
    courseId,
    canManageCourse,
    isCourseInstructor,
    studentView = false,
    courseInstructors,
    currentUserId,
}: {
    courseId: string;
    /** Módulos (criar/excluir) e responsáveis exigem courses:manage — mesmo gate do backend. */
    canManageCourse: boolean;
    isCourseInstructor: boolean;
    /** Aluno: esconde o que é de gestão (responsáveis) e mostra o próprio progresso. */
    studentView?: boolean;
    /** Instrutores da turma: são as únicas pessoas que podem ser responsáveis por um módulo. */
    courseInstructors: { userId: string; user: { name: string } }[];
    currentUserId?: string;
}) {
    const [moduleModalOpen, setModuleModalOpen] = useState(false);
    const [responsiblesModule, setResponsiblesModule] = useState<CourseModuleWithLessons | null>(null);
    const [responsibleIds, setResponsibleIds] = useState<string[]>([]);
    const [onlyMine, setOnlyMine] = useState(false);
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

    const isResponsible = (courseModule: CourseModuleWithLessons) => courseModule.instructors.some((i) => i.userId === currentUserId);
    /** Espelha o backend: admin, ou instrutor da turma — e, se o módulo tem responsáveis, só um deles. */
    const canEditModule = (courseModule: CourseModuleWithLessons) =>
        canManageCourse || (isCourseInstructor && (courseModule.instructors.length === 0 || isResponsible(courseModule)));
    /** Excluir aula: admin ou responsável explícito (módulo livre não deixa qualquer instrutor apagar). */
    const canDeleteLessonIn = (courseModule: CourseModuleWithLessons) => canManageCourse || isResponsible(courseModule);

    const createModuleMutation = useMutation({
        mutationFn: (title: string) => courseModulesApi.create(courseId, { title }),
        onSuccess: () => { toast.success('Módulo criado.'); invalidateModules(); setModuleModalOpen(false); },
        onError: (error: unknown) => toast.error(apiErrorMessage(error, 'Não foi possível criar o módulo.')),
    });

    const setResponsiblesMutation = useMutation({
        mutationFn: ({ moduleId, userIds }: { moduleId: string; userIds: string[] }) => courseModulesApi.setInstructors(courseId, moduleId, userIds),
        onSuccess: () => {
            toast.success('Responsáveis do módulo atualizados.');
            invalidateModules();
            setResponsiblesModule(null);
        },
        onError: (error: unknown) => toast.error(apiErrorMessage(error, 'Não foi possível atualizar os responsáveis.')),
    });

    const removeModuleMutation = useMutation({
        mutationFn: (moduleId: string) => courseModulesApi.remove(courseId, moduleId),
        onSuccess: () => { toast.success('Módulo removido.'); invalidateModules(); },
        onError: (error: unknown) => toast.error(apiErrorMessage(error, 'Não foi possível remover o módulo.')),
    });

    const handleRemoveModule = (moduleId: string, title: string, lessonCount: number) => {
        const warning = lessonCount > 0 ? `\n\nATENÇÃO: as ${lessonCount} aula(s) deste módulo também serão removidas.` : '';
        if (window.confirm(`Remover o módulo "${title}"?${warning}`)) removeModuleMutation.mutate(moduleId);
    };

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
        onError: (error: unknown) => toast.error(apiErrorMessage(error, `Não foi possível ${editingLesson ? 'atualizar' : 'adicionar'} a aula.`)),
    });

    const removeLessonMutation = useMutation({
        mutationFn: (lessonId: string) => courseLessonsApi.remove(courseId, lessonId),
        onSuccess: () => { toast.success('Aula removida.'); invalidateModules(); },
        onError: (error: unknown) => toast.error(apiErrorMessage(error, 'Não foi possível remover a aula.')),
    });

    const progressMutation = useMutation({
        mutationFn: ({ lessonId, completed }: { lessonId: string; completed: boolean }) => courseLessonsApi.markProgress(courseId, lessonId, completed),
        onSuccess: () => {
            invalidateModules();
            // O resumo "Meu progresso" (e o certificado, que pode ter saído agora) dependem disto.
            queryClient.invalidateQueries({ queryKey: ['me'] });
        },
        onError: (error: unknown) => toast.error(apiErrorMessage(error, 'Não foi possível salvar o progresso.')),
    });

    const allModules = modules ?? [];
    const myModulesCount = allModules.filter(isResponsible).length;
    const visibleModules = onlyMine ? allModules.filter(isResponsible) : allModules;
    const allLessons = allModules.flatMap((m) => m.lessons);
    const watchedCount = allLessons.filter((l) => l.progress?.[0]?.completed).length;

    return (
        <div>
            {studentView && allLessons.length > 0 && (
                <HelpText as="p" style={{ margin: '0 0 0.75rem' }}>
                    Você assistiu {watchedCount} de {allLessons.length} vídeo-aulas. Vídeos daqui são marcados sozinhos quando terminam; nos links externos, marque
                    você mesmo depois de assistir.
                </HelpText>
            )}
            {(canManageCourse || myModulesCount > 0) && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                    <div>
                        {myModulesCount > 0 && (
                            <FilterChip type="button" $active={onlyMine} onClick={() => setOnlyMine((value) => !value)}>
                                Só os meus módulos ({myModulesCount})
                            </FilterChip>
                        )}
                    </div>
                    {canManageCourse && (
                        <Button onClick={() => { resetModule({ title: '' }); setModuleModalOpen(true); }}>
                            <Plus size={16} /> Novo módulo
                        </Button>
                    )}
                </div>
            )}

            {visibleModules.map((courseModule) => (
                <ModuleCard key={courseModule.id}>
                    <ModuleHeader>
                        <h3>
                            {courseModule.title}
                            <small>{courseModule.lessons.length} {courseModule.lessons.length === 1 ? 'aula' : 'aulas'}</small>
                        </h3>
                        {(canEditModule(courseModule) || canManageCourse) && (
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                {canEditModule(courseModule) && (
                                    <Button $variant="ghost" onClick={() => openCreateLesson(courseModule.id)}>
                                        <Plus size={14} /> Aula
                                    </Button>
                                )}
                                {canManageCourse && (
                                    <Button
                                        $variant="ghost"
                                        onClick={() => { setResponsibleIds(courseModule.instructors.map((i) => i.userId)); setResponsiblesModule(courseModule); }}
                                        aria-label={`Definir responsáveis pelo módulo ${courseModule.title}`}
                                        title="Definir professores responsáveis"
                                    >
                                        <UserCog size={14} /> Responsáveis
                                    </Button>
                                )}
                                {canManageCourse && (
                                    <Button
                                        $variant="ghost"
                                        onClick={() => handleRemoveModule(courseModule.id, courseModule.title, courseModule.lessons.length)}
                                        aria-label={`Remover módulo ${courseModule.title}`}
                                        title="Remover módulo"
                                    >
                                        <Trash2 size={14} />
                                    </Button>
                                )}
                            </div>
                        )}
                    </ModuleHeader>

                    {!studentView && (
                        <ResponsibleLine>
                            {courseModule.instructors.length > 0 ? (
                                <>Responsável: {courseModule.instructors.map((i) => <span key={i.userId}>{i.user.name}</span>)}</>
                            ) : (
                                <>Sem responsável definido: qualquer instrutor da turma pode editar as aulas.</>
                            )}
                        </ResponsibleLine>
                    )}

                    {courseModule.lessons.length === 0 && <span style={{ fontSize: '0.8125rem', color: '#6c757d' }}>Nenhuma aula neste módulo ainda.{canEditModule(courseModule) ? ' Use “+ Aula” para adicionar.' : ''}</span>}

                    {courseModule.lessons.map((lesson) => {
                        const completed = lesson.progress?.[0]?.completed ?? false;
                        const hasContent = Boolean(lesson.content && lesson.content !== '<p></p>');
                        // Vídeo próprio: para o aluno, só o fim do vídeo marca como assistida.
                        const autoTracked = studentView && Boolean(lesson.videoKey && lesson.videoUrl);
                        return (
                            <LessonItem key={lesson.id}>
                                <LessonRow>
                                    {autoTracked ? (
                                        <span
                                            style={{ display: 'flex', color: completed ? '#28a745' : '#adb5bd' }}
                                            title={completed ? 'Assistida' : 'Será marcada como assistida quando o vídeo terminar'}
                                        >
                                            {completed ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                                        </span>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => progressMutation.mutate({ lessonId: lesson.id, completed: !completed })}
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', color: completed ? '#28a745' : '#adb5bd' }}
                                            title={completed ? 'Marcar como não assistida' : 'Marcar como assistida'}
                                            aria-label={completed ? `Marcar "${lesson.title}" como não assistida` : `Marcar "${lesson.title}" como assistida`}
                                        >
                                            {completed ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                                        </button>
                                    )}
                                    <LessonTitle>
                                        <strong>{lesson.title}</strong>
                                        {lesson.duration && <span>{Math.round(lesson.duration / 60)} min</span>}
                                    </LessonTitle>
                                    {lesson.videoUrl && !lesson.videoKey && (
                                        <Button as="a" href={lesson.videoUrl} target="_blank" rel="noreferrer" $variant="ghost">
                                            <PlayCircle size={14} /> Assistir
                                        </Button>
                                    )}
                                    {canEditModule(courseModule) && (
                                        <Button $variant="ghost" onClick={() => openEditLesson(lesson)} aria-label={`Editar aula ${lesson.title}`} title="Editar aula">
                                            <Pencil size={14} />
                                        </Button>
                                    )}
                                    {canDeleteLessonIn(courseModule) && (
                                        <Button
                                            $variant="ghost"
                                            onClick={() => { if (window.confirm(`Remover a aula "${lesson.title}"?`)) removeLessonMutation.mutate(lesson.id); }}
                                            aria-label={`Remover aula ${lesson.title}`}
                                            title="Remover aula"
                                        >
                                            <Trash2 size={14} />
                                        </Button>
                                    )}
                                </LessonRow>
                                {(lesson.videoKey || hasContent) && (
                                    <LessonExtra>
                                        {lesson.videoKey && lesson.videoUrl && (
                                            <video
                                                controls
                                                preload="metadata"
                                                src={lesson.videoUrl}
                                                onEnded={() => {
                                                    if (studentView && !completed) progressMutation.mutate({ lessonId: lesson.id, completed: true });
                                                }}
                                            />
                                        )}
                                        {hasContent && <RichTextViewer html={lesson.content!} />}
                                    </LessonExtra>
                                )}
                            </LessonItem>
                        );
                    })}
                </ModuleCard>
            ))}

            {allModules.length === 0 && (
                <TableWrapper>
                    <EmptyState>Nenhum módulo de vídeo-aula criado ainda.</EmptyState>
                </TableWrapper>
            )}

            <Modal open={!!responsiblesModule} onOpenChange={(open) => !open && setResponsiblesModule(null)} title={`Responsáveis — ${responsiblesModule?.title ?? ''}`}>
                <Form
                    onSubmit={(e) => {
                        e.preventDefault();
                        if (responsiblesModule) setResponsiblesMutation.mutate({ moduleId: responsiblesModule.id, userIds: responsibleIds });
                    }}
                >
                    {courseInstructors.length === 0 ? (
                        <HelpText>Esta turma ainda não tem instrutores. Adicione-os em “Editar turma”.</HelpText>
                    ) : (
                        <Field>
                            <Label>Professores responsáveis por este módulo</Label>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                {courseInstructors.map((instructor) => (
                                    <label key={instructor.userId} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem' }}>
                                        <input
                                            type="checkbox"
                                            checked={responsibleIds.includes(instructor.userId)}
                                            onChange={(e) =>
                                                setResponsibleIds((current) => (e.target.checked ? [...current, instructor.userId] : current.filter((id) => id !== instructor.userId)))
                                            }
                                        />
                                        {instructor.user.name}
                                    </label>
                                ))}
                            </div>
                            <HelpText>
                                Com responsáveis marcados, só eles (e a coordenação) criam e editam as aulas deste módulo. Sem ninguém marcado, qualquer instrutor da turma pode editar.
                            </HelpText>
                        </Field>
                    )}
                    <FormActions>
                        <Button type="button" $variant="secondary" onClick={() => setResponsiblesModule(null)}>Cancelar</Button>
                        <Button type="submit" disabled={setResponsiblesMutation.isPending}>{setResponsiblesMutation.isPending ? 'Salvando...' : 'Salvar'}</Button>
                    </FormActions>
                </Form>
            </Modal>

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
