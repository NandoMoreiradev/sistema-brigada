// frontend/src/pages/course-detail/LessonsTab.tsx
//
// Módulos + aulas em vídeo de uma turma (decisão de reaproveitamento em docs/decisoes.md:
// TrainingModule/Lesson/Progress do maskotCrmEdu, agora escopado por Course).

import { useState } from 'react';
import styled from 'styled-components';
import { Plus, PlayCircle, CheckCircle2, Circle, Trash2, Pencil } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Field, Label, Input, Select, HelpText, Form, FormActions } from '@/components/ui/FormField';
import { TableWrapper, EmptyState } from '@/components/ui/Table';
import { courseModulesApi, courseLessonsApi, type CourseLesson, type CourseLessonInput } from '@/services/courses';
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
 */
export function LessonsTab({
    courseId,
    canManageCourse,
    canEditLessons,
}: {
    courseId: string;
    /** Módulos (criar/editar/excluir) e excluir aula exigem courses:manage — mesmo gate do backend. */
    canManageCourse: boolean;
    /** Criar/editar aula é liberado também pra instrutor da turma (course-lessons.controller.ts). */
    canEditLessons: boolean;
}) {
    const [moduleModalOpen, setModuleModalOpen] = useState(false);
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

    const createModuleMutation = useMutation({
        mutationFn: (title: string) => courseModulesApi.create(courseId, { title }),
        onSuccess: () => { toast.success('Módulo criado.'); invalidateModules(); setModuleModalOpen(false); },
        onError: (error: unknown) => toast.error(apiErrorMessage(error, 'Não foi possível criar o módulo.')),
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
        onSuccess: () => invalidateModules(),
        onError: (error: unknown) => toast.error(apiErrorMessage(error, 'Não foi possível salvar o progresso.')),
    });

    return (
        <div>
            {canManageCourse && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.75rem' }}>
                    <Button onClick={() => { resetModule({ title: '' }); setModuleModalOpen(true); }}>
                        <Plus size={16} /> Novo módulo
                    </Button>
                </div>
            )}

            {(modules ?? []).map((courseModule) => (
                <ModuleCard key={courseModule.id}>
                    <ModuleHeader>
                        <h3>
                            {courseModule.title}
                            <small>{courseModule.lessons.length} {courseModule.lessons.length === 1 ? 'aula' : 'aulas'}</small>
                        </h3>
                        {(canEditLessons || canManageCourse) && (
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                {canEditLessons && (
                                    <Button $variant="ghost" onClick={() => openCreateLesson(courseModule.id)}>
                                        <Plus size={14} /> Aula
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

                    {courseModule.lessons.length === 0 && <span style={{ fontSize: '0.8125rem', color: '#6c757d' }}>Nenhuma aula neste módulo ainda.{canEditLessons ? ' Use “+ Aula” para adicionar.' : ''}</span>}

                    {courseModule.lessons.map((lesson) => {
                        const completed = lesson.progress?.[0]?.completed ?? false;
                        const hasContent = Boolean(lesson.content && lesson.content !== '<p></p>');
                        return (
                            <LessonItem key={lesson.id}>
                                <LessonRow>
                                    <button
                                        type="button"
                                        onClick={() => progressMutation.mutate({ lessonId: lesson.id, completed: !completed })}
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', color: completed ? '#28a745' : '#adb5bd' }}
                                        title={completed ? 'Marcar como não assistida' : 'Marcar como assistida'}
                                    >
                                        {completed ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                                    </button>
                                    <LessonTitle>
                                        <strong>{lesson.title}</strong>
                                        {lesson.duration && <span>{Math.round(lesson.duration / 60)} min</span>}
                                    </LessonTitle>
                                    {lesson.videoUrl && !lesson.videoKey && (
                                        <Button as="a" href={lesson.videoUrl} target="_blank" rel="noreferrer" $variant="ghost">
                                            <PlayCircle size={14} /> Assistir
                                        </Button>
                                    )}
                                    {canEditLessons && (
                                        <Button $variant="ghost" onClick={() => openEditLesson(lesson)} aria-label={`Editar aula ${lesson.title}`} title="Editar aula">
                                            <Pencil size={14} />
                                        </Button>
                                    )}
                                    {canManageCourse && (
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
                                        {lesson.videoKey && lesson.videoUrl && <video controls src={lesson.videoUrl} />}
                                        {hasContent && <RichTextViewer html={lesson.content!} />}
                                    </LessonExtra>
                                )}
                            </LessonItem>
                        );
                    })}
                </ModuleCard>
            ))}

            {(modules ?? []).length === 0 && (
                <TableWrapper>
                    <EmptyState>Nenhum módulo de vídeo-aula criado ainda.</EmptyState>
                </TableWrapper>
            )}

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
