// frontend/src/pages/course-detail/LessonsTab.tsx
//
// Módulos + aulas em vídeo de uma turma (decisão de reaproveitamento em docs/decisoes.md:
// TrainingModule/Lesson/Progress do maskotCrmEdu, agora escopado por Course).

import { useState } from 'react';
import styled from 'styled-components';
import {
    Plus,
    Eye,
    CheckCircle2,
    Circle,
    Trash2,
    Pencil,
    UserCog,
    ChevronDown,
    FileText,
    Image as ImageIcon,
    Music,
    X,
    Link2,
    Upload,
    ArrowUp,
    ArrowDown,
    type LucideIcon,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Field, Label, Input, HelpText, Form, FormActions } from '@/components/ui/FormField';
import { FilterChip } from './styles';
import { TableWrapper, EmptyState } from '@/components/ui/Table';
import {
    courseModulesApi,
    courseLessonsApi,
    type CourseLesson,
    type CourseLessonInput,
    type CourseLessonVideoInput,
    type CourseModuleWithLessons,
} from '@/services/courses';
import { mediaApi } from '@/services/media';
import { toast } from '@/utils/toast';
import { apiErrorMessage } from '@/utils/apiError';
import { RichTextEditor } from '@/components/ui/RichTextEditor';
import { LessonViewer } from './lessons/LessonViewer';
import { formatFileSize, formatLessonDuration } from './lessons/lessonMedia';

const VIDEO_ALLOWED_TYPES = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-matroska'];
const VIDEO_MAX_SIZE = 500 * 1024 * 1024; // 500MB — mesmo teto do contexto 'course-lessons' em media.service.ts

// Material de apoio — espelha o contexto 'course-lesson-files' em media.service.ts.
const MATERIAL_ALLOWED_TYPES = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/csv',
    'application/zip',
    'application/x-zip-compressed',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/svg+xml',
    'audio/webm',
    'audio/mp4',
    'audio/ogg',
    'audio/mpeg',
    'audio/wav',
];
const MATERIAL_ACCEPT = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,image/*,audio/*';
const MATERIAL_MAX_SIZE = 100 * 1024 * 1024; // 100MB

/** Vídeo no modal da aula: `id` = já salvo; `file` = arquivo escolhido, enviado só ao salvar. */
interface VideoDraft {
    key: string;
    id?: string;
    kind: 'link' | 'upload';
    title: string;
    url: string;
    storageKey?: string;
    file?: File;
}

function materialIcon(mime: string | null): LucideIcon {
    if (mime?.startsWith('image/')) return ImageIcon;
    if (mime?.startsWith('audio/')) return Music;
    return FileText;
}

const ModuleCard = styled.div`
    background: ${({ theme }) => theme.colors.white};
    border: 1px solid ${({ theme }) => theme.colors.borderLight};
    border-radius: ${({ theme }) => theme.radii.md};
    padding: 1rem 1.25rem;
    margin-bottom: 0.875rem;
`;

const ModuleHeader = styled.div<{ $collapsed: boolean }>`
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: ${({ $collapsed }) => ($collapsed ? '0' : '0.5rem')};

    h3 {
        margin: 0;
        font-size: 0.9375rem;
        font-weight: 700;
        color: ${({ theme }) => theme.colors.textDark};
    }

    small {
        font-size: 0.7rem;
        font-weight: 600;
        color: ${({ theme }) => theme.colors.textMuted};
    }
`;

const ModuleToggle = styled.button<{ $collapsed: boolean }>`
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
    padding: 0;
    background: none;
    border: none;
    cursor: pointer;
    font: inherit;
    color: inherit;
    text-align: left;

    svg {
        align-self: center;
        flex-shrink: 0;
        color: ${({ theme }) => theme.colors.textMuted};
        transform: rotate(${({ $collapsed }) => ($collapsed ? '-90deg' : '0deg')});
        transition: transform 0.15s ease;
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

const MaterialList = styled.ul`
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.3rem;

    li {
        display: flex;
        align-items: center;
        gap: 0.45rem;
        font-size: 0.8125rem;
    }

    a {
        color: ${({ theme }) => theme.colors.primary};
        text-decoration: none;
        word-break: break-word;

        &:hover { text-decoration: underline; }
    }

    small {
        font-size: 0.7rem;
        color: ${({ theme }) => theme.colors.textMuted};
    }

    svg { flex-shrink: 0; color: ${({ theme }) => theme.colors.textMuted}; }
`;

const RemoveMaterialButton = styled.button`
    display: flex;
    margin-left: auto;
    padding: 0.15rem;
    background: none;
    border: none;
    cursor: pointer;
    color: ${({ theme }) => theme.colors.textMuted};

    &:hover { color: ${({ theme }) => theme.colors.danger}; }
`;

const VideoDraftCard = styled.div`
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    padding: 0.6rem 0.75rem;
    margin-bottom: 0.5rem;
    border: 1px solid ${({ theme }) => theme.colors.borderLight};
    border-radius: ${({ theme }) => theme.radii.sm};
`;

const VideoDraftHeader = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;

    strong {
        display: flex;
        align-items: center;
        gap: 0.35rem;
        font-size: 0.75rem;
        color: ${({ theme }) => theme.colors.textDark};
    }

    div { display: flex; gap: 0.15rem; }
`;

const IconButton = styled.button<{ $danger?: boolean }>`
    display: flex;
    padding: 0.2rem;
    background: none;
    border: none;
    cursor: pointer;
    color: ${({ theme }) => theme.colors.textMuted};

    &:hover:not(:disabled) { color: ${({ theme, $danger }) => ($danger ? theme.colors.danger : theme.colors.textDark)}; }
    &:disabled { opacity: 0.35; cursor: default; }
`;

/** Prévia da aula (o mesmo conteúdo que o aluno vê), aberta sob a linha da aula. */
const LessonExtra = styled.div`
    margin: 0.75rem 0 0.5rem 1.9rem;
    max-width: 760px;

    @media (max-width: 640px) {
        margin-left: 0;
    }
`;

/**
 * Módulos + aulas em vídeo de uma turma (decisão de reaproveitamento em
 * docs/decisoes.md: TrainingModule/Lesson/Progress do maskotCrmEdu, agora
 * escopado por Course). Uma aula pode ter vários vídeos (CourseLessonVideo), cada um sendo um
 * link colado (só `url`) ou um arquivo enviado direto pro R2 via presigned URL (`url` = URL
 * pública do upload, `storageKey` = chave no bucket). YouTube/Vimeo tocam embutidos; os demais
 * links abrem em nova aba, já que não dá pra assumir que são embutíveis (ver lessons/lessonMedia.ts).
 *
 * Esta é a visão de gestão (coordenação e instrutores). O aluno vê as mesmas aulas no player de
 * lessons/StudentLessons.tsx, onde o progresso é acompanhado; aqui "Ver aula" mostra a prévia.
 *
 * Material de apoio (PDF, slides, planilha...): anexos da aula (CourseLessonFile), escolhidos no
 * modal e enviados ao salvar — numa aula nova ainda não existe id para pendurar o arquivo.
 */
export function LessonsTab({
    courseId,
    canManageCourse,
    isCourseInstructor,
    courseInstructors,
    currentUserId,
}: {
    courseId: string;
    /** Módulos (criar/excluir) e responsáveis exigem courses:manage — mesmo gate do backend. */
    canManageCourse: boolean;
    isCourseInstructor: boolean;
    /** Instrutores da turma: são as únicas pessoas que podem ser responsáveis por um módulo. */
    courseInstructors: { userId: string; user: { name: string } }[];
    currentUserId?: string;
}) {
    const [moduleModalOpen, setModuleModalOpen] = useState(false);
    /** Módulo cujo título está sendo editado; null = o modal está criando um módulo novo. */
    const [editingModule, setEditingModule] = useState<CourseModuleWithLessons | null>(null);
    const [responsiblesModule, setResponsiblesModule] = useState<CourseModuleWithLessons | null>(null);
    const [responsibleIds, setResponsibleIds] = useState<string[]>([]);
    const [onlyMine, setOnlyMine] = useState(false);
    const [collapsedModuleIds, setCollapsedModuleIds] = useState<Set<string>>(new Set());
    /** Aulas com a prévia aberta (vídeo, texto e material, como o aluno vê). */
    const [previewLessonIds, setPreviewLessonIds] = useState<Set<string>>(new Set());
    const [lessonModalModuleId, setLessonModalModuleId] = useState<string | null>(null);
    const [editingLesson, setEditingLesson] = useState<CourseLesson | null>(null);
    /** Vídeos da aula em edição, na ordem; arquivos novos só sobem ao salvar. */
    const [videoDrafts, setVideoDrafts] = useState<VideoDraft[]>([]);
    const [videoUploadLabel, setVideoUploadLabel] = useState<string | null>(null);
    const [lessonContent, setLessonContent] = useState('');
    /** Materiais escolhidos no modal, enviados só ao salvar (a aula nova ainda não tem id). */
    const [pendingMaterials, setPendingMaterials] = useState<File[]>([]);
    /** Materiais já salvos que o usuário tirou no modal — removidos de fato ao salvar. */
    const [removedMaterialIds, setRemovedMaterialIds] = useState<string[]>([]);
    const [isUploadingMaterials, setIsUploadingMaterials] = useState(false);
    const queryClient = useQueryClient();

    const { data: modules } = useQuery({ queryKey: ['courses', courseId, 'modules'], queryFn: () => courseModulesApi.list(courseId) });

    const { register: registerModule, handleSubmit: handleSubmitModule, reset: resetModule } = useForm<{ title: string }>();
    const { register: registerLesson, handleSubmit: handleSubmitLesson, reset: resetLesson } = useForm<{ title: string; duration: string }>();

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

    const renameModuleMutation = useMutation({
        mutationFn: ({ moduleId, title }: { moduleId: string; title: string }) => courseModulesApi.update(courseId, moduleId, { title }),
        onSuccess: () => { toast.success('Módulo atualizado.'); invalidateModules(); setModuleModalOpen(false); },
        onError: (error: unknown) => toast.error(apiErrorMessage(error, 'Não foi possível atualizar o módulo.')),
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

    const toggleModule = (moduleId: string) =>
        setCollapsedModuleIds((current) => {
            const next = new Set(current);
            if (next.has(moduleId)) next.delete(moduleId);
            else next.add(moduleId);
            return next;
        });

    const handleRemoveModule =(moduleId: string, title: string, lessonCount: number) => {
        const warning = lessonCount > 0 ? `\n\nATENÇÃO: as ${lessonCount} aula(s) deste módulo também serão removidas.` : '';
        if (window.confirm(`Remover o módulo "${title}"?${warning}`)) removeModuleMutation.mutate(moduleId);
    };

    const closeLessonModal = () => {
        setLessonModalModuleId(null);
        setEditingLesson(null);
        setVideoDrafts([]);
        setPendingMaterials([]);
        setRemovedMaterialIds([]);
    };

    const addVideoDraft = (kind: VideoDraft['kind']) =>
        setVideoDrafts((current) => [...current, { key: `new-${Date.now()}-${current.length}`, kind, title: '', url: '' }]);

    const updateVideoDraft = (key: string, changes: Partial<VideoDraft>) =>
        setVideoDrafts((current) => current.map((draft) => (draft.key === key ? { ...draft, ...changes } : draft)));

    const moveVideoDraft = (index: number, delta: -1 | 1) =>
        setVideoDrafts((current) => {
            const target = index + delta;
            if (target < 0 || target >= current.length) return current;
            const next = [...current];
            [next[index], next[target]] = [next[target], next[index]];
            return next;
        });

    const selectVideoFile = (key: string, file: File | undefined) => {
        if (!file) return;
        if (!VIDEO_ALLOWED_TYPES.includes(file.type)) {
            toast.error('Tipo de arquivo não permitido. Envie um vídeo MP4, MOV, WEBM ou MKV.');
            return;
        }
        if (file.size > VIDEO_MAX_SIZE) {
            toast.error('O vídeo deve ter no máximo 500MB.');
            return;
        }
        // Trocar o arquivo de um vídeo já salvo vira um vídeo novo (o progresso do antigo não vale pro novo).
        updateVideoDraft(key, { file, id: undefined, url: '', storageKey: undefined });
    };

    const addPendingMaterials = (files: FileList | null) => {
        const accepted: File[] = [];
        for (const file of Array.from(files ?? [])) {
            if (!MATERIAL_ALLOWED_TYPES.includes(file.type)) {
                toast.error(`"${file.name}": tipo não permitido. Envie PDF, Word, Excel, PowerPoint, texto, ZIP, imagem ou áudio.`);
            } else if (file.size > MATERIAL_MAX_SIZE) {
                toast.error(`"${file.name}": o arquivo deve ter no máximo 100MB.`);
            } else {
                accepted.push(file);
            }
        }
        if (accepted.length > 0) setPendingMaterials((current) => [...current, ...accepted]);
    };

    const openCreateLesson = (moduleId: string) => {
        resetLesson({ title: '', duration: '' });
        setLessonContent('');
        setVideoDrafts([]);
        setPendingMaterials([]);
        setRemovedMaterialIds([]);
        setEditingLesson(null);
        setLessonModalModuleId(moduleId);
    };

    const openEditLesson = (lesson: CourseLesson) => {
        resetLesson({
            title: lesson.title,
            duration: lesson.duration ? String(Math.round(lesson.duration / 60)) : '',
        });
        setLessonContent(lesson.content ?? '');
        setVideoDrafts(
            (lesson.videos ?? []).map((video) => ({
                key: video.id,
                id: video.id,
                kind: video.storageKey ? 'upload' : 'link',
                title: video.title ?? '',
                url: video.url,
                storageKey: video.storageKey ?? undefined,
            })),
        );
        setPendingMaterials([]);
        setRemovedMaterialIds([]);
        setEditingLesson(lesson);
        setLessonModalModuleId(lesson.moduleId);
    };

    const saveLessonMutation = useMutation({
        mutationFn: async (data: { title: string; duration: string }) => {
            const moduleId = editingLesson?.moduleId ?? lessonModalModuleId;
            if (!moduleId) throw new Error('Módulo não selecionado.');

            // Valida tudo antes de subir qualquer arquivo.
            videoDrafts.forEach((draft, index) => {
                const label = draft.title.trim() || `Vídeo ${index + 1}`;
                if (draft.kind === 'link' && !draft.url.trim()) throw new Error(`Informe o link de "${label}" ou remova-o.`);
                if (draft.kind === 'upload' && !draft.file && !draft.storageKey) throw new Error(`Escolha o arquivo de "${label}" ou remova-o.`);
            });

            const videos: CourseLessonVideoInput[] = [];
            const filesToUpload = videoDrafts.filter((draft) => draft.file).length;
            let uploaded = 0;
            try {
                for (const draft of videoDrafts) {
                    const title = draft.title.trim() || undefined;
                    if (draft.file) {
                        uploaded += 1;
                        setVideoUploadLabel(filesToUpload > 1 ? `Enviando vídeo ${uploaded} de ${filesToUpload}...` : 'Enviando vídeo...');
                        const { fileUrl, storageKey } = await mediaApi.upload(draft.file, 'course-lessons');
                        videos.push({ title, url: fileUrl, storageKey });
                    } else {
                        videos.push({ id: draft.id, title, url: draft.url.trim(), storageKey: draft.storageKey });
                    }
                }
            } finally {
                setVideoUploadLabel(null);
            }

            const payload: Partial<CourseLessonInput> = {
                title: data.title,
                content: lessonContent,
                duration: data.duration ? Number(data.duration) * 60 : undefined,
                videos,
            };

            const lesson = editingLesson
                ? await courseLessonsApi.update(courseId, editingLesson.id, payload)
                : await courseLessonsApi.create(courseId, { moduleId, ...payload } as CourseLessonInput);

            if (pendingMaterials.length > 0 || removedMaterialIds.length > 0) {
                setIsUploadingMaterials(true);
                try {
                    for (const file of pendingMaterials) {
                        const { fileUrl, storageKey } = await mediaApi.upload(file, 'course-lesson-files');
                        await courseLessonsApi.addFile(courseId, lesson.id, {
                            name: file.name,
                            storageKey,
                            externalUrl: fileUrl,
                            mimeType: file.type,
                            size: file.size,
                        });
                    }
                    for (const fileId of removedMaterialIds) {
                        await courseLessonsApi.removeFile(courseId, lesson.id, fileId);
                    }
                } catch (error) {
                    // A aula já foi salva: atualiza a lista para a tela refletir o que de fato entrou.
                    invalidateModules();
                    throw error;
                } finally {
                    setIsUploadingMaterials(false);
                }
            }
            return lesson;
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

    const togglePreview = (lessonId: string) =>
        setPreviewLessonIds((current) => {
            const next = new Set(current);
            if (next.has(lessonId)) next.delete(lessonId);
            else next.add(lessonId);
            return next;
        });

    const keptMaterials = (editingLesson?.files ?? []).filter((file) => !removedMaterialIds.includes(file.id));
    const allModules = modules ?? [];
    const myModulesCount = allModules.filter(isResponsible).length;
    const visibleModules = onlyMine ? allModules.filter(isResponsible) : allModules;

    return (
        <div>
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
                        <Button onClick={() => { setEditingModule(null); resetModule({ title: '' }); setModuleModalOpen(true); }}>
                            <Plus size={16} /> Novo módulo
                        </Button>
                    )}
                </div>
            )}

            {visibleModules.map((courseModule) => {
                const collapsed = collapsedModuleIds.has(courseModule.id);
                const contentId = `module-${courseModule.id}-lessons`;
                return (
                    <ModuleCard key={courseModule.id}>
                        <ModuleHeader $collapsed={collapsed}>
                            <h3>
                                <ModuleToggle
                                    type="button"
                                    $collapsed={collapsed}
                                    onClick={() => toggleModule(courseModule.id)}
                                    aria-expanded={!collapsed}
                                    aria-controls={contentId}
                                    title={collapsed ? 'Expandir módulo' : 'Recolher módulo'}
                                >
                                    <ChevronDown size={16} />
                                    {courseModule.title}
                                    <small>{courseModule.lessons.length} {courseModule.lessons.length === 1 ? 'aula' : 'aulas'}</small>
                                </ModuleToggle>
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
                                            onClick={() => { setEditingModule(courseModule); resetModule({ title: courseModule.title }); setModuleModalOpen(true); }}
                                            aria-label={`Renomear módulo ${courseModule.title}`}
                                            title="Renomear módulo"
                                        >
                                            <Pencil size={14} />
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

                        <div id={contentId} hidden={collapsed}>
                            <ResponsibleLine>
                                {courseModule.instructors.length > 0 ? (
                                    <>Responsável: {courseModule.instructors.map((i) => <span key={i.userId}>{i.user.name}</span>)}</>
                                ) : (
                                    <>Sem responsável definido: qualquer instrutor da turma pode editar as aulas.</>
                                )}
                            </ResponsibleLine>

                            {courseModule.lessons.length === 0 && <span style={{ fontSize: '0.8125rem', color: '#6c757d' }}>Nenhuma aula neste módulo ainda.{canEditModule(courseModule) ? ' Use “+ Aula” para adicionar.' : ''}</span>}

                            {courseModule.lessons.map((lesson) => {
                                const completed = lesson.progress?.[0]?.completed ?? false;
                                const hasContent = Boolean(lesson.content && lesson.content !== '<p></p>');
                                const videoCount = (lesson.videos ?? []).length;
                                const fileCount = (lesson.files ?? []).length;
                                const previewOpen = previewLessonIds.has(lesson.id);
                                const previewId = `lesson-${lesson.id}-preview`;
                                const details = [
                                    formatLessonDuration(lesson.duration),
                                    videoCount > 0 ? `${videoCount} ${videoCount === 1 ? 'vídeo' : 'vídeos'}` : null,
                                    fileCount > 0 ? `${fileCount} ${fileCount === 1 ? 'arquivo' : 'arquivos'}` : null,
                                ]
                                    .filter(Boolean)
                                    .join(' · ');
                                return (
                                    <LessonItem key={lesson.id}>
                                        <LessonRow>
                                            <button
                                                type="button"
                                                onClick={() => progressMutation.mutate({ lessonId: lesson.id, completed: !completed })}
                                                style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', color: completed ? '#28a745' : '#adb5bd' }}
                                                title={completed ? 'Marcar como não assistida' : 'Marcar como assistida'}
                                                aria-label={completed ? `Marcar "${lesson.title}" como não assistida` : `Marcar "${lesson.title}" como assistida`}
                                            >
                                                {completed ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                                            </button>
                                            <LessonTitle>
                                                <strong>{lesson.title}</strong>
                                                {details && <span>{details}</span>}
                                            </LessonTitle>
                                            {(videoCount > 0 || hasContent || fileCount > 0) && (
                                                <Button
                                                    $variant="ghost"
                                                    onClick={() => togglePreview(lesson.id)}
                                                    aria-expanded={previewOpen}
                                                    aria-controls={previewId}
                                                    title={previewOpen ? 'Ocultar a aula' : 'Ver a aula como o aluno vê'}
                                                >
                                                    <Eye size={14} /> {previewOpen ? 'Ocultar' : 'Ver aula'}
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
                                        {previewOpen && (
                                            <LessonExtra id={previewId}>
                                                <LessonViewer lesson={lesson} />
                                            </LessonExtra>
                                        )}
                                    </LessonItem>
                                );
                            })}
                        </div>
                    </ModuleCard>
                );
            })}

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

            <Modal open={moduleModalOpen} onOpenChange={setModuleModalOpen} title={editingModule ? 'Editar módulo' : 'Novo módulo'}>
                <Form
                    onSubmit={handleSubmitModule((data) =>
                        editingModule
                            ? renameModuleMutation.mutate({ moduleId: editingModule.id, title: data.title.trim() })
                            : createModuleMutation.mutate(data.title),
                    )}
                >
                    <Field>
                        <Label htmlFor="moduleTitle">Título do módulo</Label>
                        <Input id="moduleTitle" placeholder="ex: Módulo 1 — Fundamentos" {...registerModule('title', { required: true })} />
                    </Field>
                    <FormActions>
                        <Button type="button" $variant="secondary" onClick={() => setModuleModalOpen(false)}>Cancelar</Button>
                        <Button type="submit" disabled={createModuleMutation.isPending || renameModuleMutation.isPending}>
                            {createModuleMutation.isPending || renameModuleMutation.isPending ? 'Salvando...' : editingModule ? 'Salvar' : 'Criar'}
                        </Button>
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
                        <Label>Vídeos</Label>
                        {videoDrafts.length === 0 && <HelpText>Nenhum vídeo nesta aula. Adicione um link ou envie um arquivo.</HelpText>}
                        {videoDrafts.map((draft, index) => (
                            <VideoDraftCard key={draft.key}>
                                <VideoDraftHeader>
                                    <strong>
                                        {draft.kind === 'upload' ? <Upload size={13} /> : <Link2 size={13} />} Vídeo {index + 1}
                                    </strong>
                                    <div>
                                        <IconButton type="button" onClick={() => moveVideoDraft(index, -1)} disabled={index === 0} aria-label="Mover para cima" title="Mover para cima">
                                            <ArrowUp size={14} />
                                        </IconButton>
                                        <IconButton
                                            type="button"
                                            onClick={() => moveVideoDraft(index, 1)}
                                            disabled={index === videoDrafts.length - 1}
                                            aria-label="Mover para baixo"
                                            title="Mover para baixo"
                                        >
                                            <ArrowDown size={14} />
                                        </IconButton>
                                        <IconButton
                                            type="button"
                                            $danger
                                            onClick={() => setVideoDrafts((current) => current.filter((d) => d.key !== draft.key))}
                                            aria-label={`Remover vídeo ${index + 1}`}
                                            title="Remover vídeo"
                                        >
                                            <X size={14} />
                                        </IconButton>
                                    </div>
                                </VideoDraftHeader>
                                <Input
                                    placeholder="Título do vídeo (opcional), ex: Parte 1 — Introdução"
                                    value={draft.title}
                                    onChange={(e) => updateVideoDraft(draft.key, { title: e.target.value })}
                                    aria-label={`Título do vídeo ${index + 1}`}
                                />
                                {draft.kind === 'link' ? (
                                    <Input
                                        placeholder="https://..."
                                        value={draft.url}
                                        onChange={(e) => updateVideoDraft(draft.key, { url: e.target.value })}
                                        aria-label={`Link do vídeo ${index + 1}`}
                                    />
                                ) : (
                                    <>
                                        {draft.storageKey && !draft.file && <HelpText>Vídeo já enviado. Escolha outro arquivo para substituí-lo.</HelpText>}
                                        {draft.file && <HelpText>{draft.file.name} ({formatFileSize(draft.file.size)}) — será enviado ao salvar.</HelpText>}
                                        <input
                                            type="file"
                                            accept={VIDEO_ALLOWED_TYPES.join(',')}
                                            aria-label={`Arquivo do vídeo ${index + 1}`}
                                            onChange={(e) => {
                                                selectVideoFile(draft.key, e.target.files?.[0]);
                                                e.target.value = '';
                                            }}
                                        />
                                    </>
                                )}
                            </VideoDraftCard>
                        ))}
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <Button type="button" $variant="secondary" onClick={() => addVideoDraft('link')}>
                                <Link2 size={14} /> Adicionar link
                            </Button>
                            <Button type="button" $variant="secondary" onClick={() => addVideoDraft('upload')}>
                                <Upload size={14} /> Enviar arquivo de vídeo
                            </Button>
                        </div>
                        <HelpText>Arquivos: MP4, MOV, WEBM ou MKV, até 500MB cada. Os vídeos aparecem para o aluno nesta ordem.</HelpText>
                    </Field>

                    <Field>
                        <Label htmlFor="duration">Duração (minutos, opcional)</Label>
                        <Input id="duration" type="number" min={0} {...registerLesson('duration')} />
                    </Field>

                    <Field>
                        <Label>Conteúdo (opcional)</Label>
                        <RichTextEditor value={lessonContent} onChange={setLessonContent} disabled={saveLessonMutation.isPending} />
                    </Field>

                    <Field>
                        <Label htmlFor="lessonMaterials">Material de apoio (opcional)</Label>
                        {(keptMaterials.length > 0 || pendingMaterials.length > 0) && (
                            <MaterialList style={{ marginBottom: '0.5rem' }}>
                                {keptMaterials.map((file) => {
                                    const Icon = materialIcon(file.mimeType);
                                    return (
                                        <li key={file.id}>
                                            <Icon size={14} />
                                            <span>{file.name}</span>
                                            {file.size ? <small>{formatFileSize(file.size)}</small> : null}
                                            <RemoveMaterialButton
                                                type="button"
                                                onClick={() => setRemovedMaterialIds((current) => [...current, file.id])}
                                                aria-label={`Remover ${file.name}`}
                                                title="Remover"
                                            >
                                                <X size={14} />
                                            </RemoveMaterialButton>
                                        </li>
                                    );
                                })}
                                {pendingMaterials.map((file, index) => {
                                    const Icon = materialIcon(file.type);
                                    return (
                                        <li key={`pending-${index}-${file.name}`}>
                                            <Icon size={14} />
                                            <span>{file.name}</span>
                                            <small>{formatFileSize(file.size)} · novo</small>
                                            <RemoveMaterialButton
                                                type="button"
                                                onClick={() => setPendingMaterials((current) => current.filter((_, i) => i !== index))}
                                                aria-label={`Remover ${file.name}`}
                                                title="Remover"
                                            >
                                                <X size={14} />
                                            </RemoveMaterialButton>
                                        </li>
                                    );
                                })}
                            </MaterialList>
                        )}
                        <input
                            id="lessonMaterials"
                            type="file"
                            multiple
                            accept={MATERIAL_ACCEPT}
                            onChange={(e) => {
                                addPendingMaterials(e.target.files);
                                e.target.value = ''; // permite escolher o mesmo arquivo de novo depois de tirá-lo da lista
                            }}
                        />
                        <HelpText>PDF, Word, Excel, PowerPoint, texto, ZIP, imagem ou áudio, até 100MB cada. Os arquivos são enviados ao salvar.</HelpText>
                    </Field>

                    <FormActions>
                        <Button type="button" $variant="secondary" onClick={closeLessonModal}>Cancelar</Button>
                        <Button type="submit" disabled={saveLessonMutation.isPending}>
                            {videoUploadLabel ? videoUploadLabel : isUploadingMaterials ? 'Enviando arquivos...' : saveLessonMutation.isPending ? 'Salvando...' : editingLesson ? 'Salvar' : 'Adicionar'}
                        </Button>
                    </FormActions>
                </Form>
            </Modal>
        </div>
    );
}
