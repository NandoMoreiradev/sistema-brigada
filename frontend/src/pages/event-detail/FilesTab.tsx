// frontend/src/pages/event-detail/FilesTab.tsx
//
// Aba Arquivos: lista compacta (ícone por tipo, nome, data e ações de visualizar/abrir na mesma
// linha; renomear/remover atrás de um "⋯"). Adicionar/renomear/remover exige `events:manage`.

import { useState } from 'react';
import { Plus, ExternalLink, Pencil, Trash2, Eye, FileText, Image as ImageIcon, Music, Link2, type LucideIcon } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/Button';
import { ActionMenu, MoreButton } from '@/components/ui/ActionMenu';
import { Modal } from '@/components/ui/Modal';
import { Field, Label, Input, Select, Form, FormActions, HelpText } from '@/components/ui/FormField';
import { EmptyState } from '@/components/ui/Table';
import { AudioRecorder } from '@/components/media/AudioRecorder';
import { eventFilesApi, type EventFile } from '@/services/events';
import { mediaApi } from '@/services/media';
import { toast } from '@/utils/toast';
import { useAuth } from '@/contexts/AuthContext';
import { hasPermission } from '@/utils/permissions';
import { formatAppDate } from '@/utils/datetime';
import { TabBar, CompactList, CompactRow, RowMain, InlineAction, TypeIcon } from './ListParts';

const EVENT_FILE_ALLOWED_TYPES = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
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
const EVENT_FILE_MAX_SIZE = 25 * 1024 * 1024; // 25MB — mesmo padrão de media.service.ts

function fileIcon(mime: string, hasUrl: boolean): LucideIcon {
    if (mime.startsWith('image/')) return ImageIcon;
    if (mime.startsWith('audio/')) return Music;
    if (mime === 'application/pdf' || mime.includes('word')) return FileText;
    return hasUrl ? Link2 : FileText;
}

/** Ações inline de um arquivo: Visualizar (imagem/PDF/áudio, num modal) e Abrir (nova aba). */
function FilePreview({ file }: { file: EventFile }) {
    const [previewOpen, setPreviewOpen] = useState(false);
    const url = file.externalUrl;
    const mime = file.mimeType ?? '';
    const canPreview = Boolean(url) && (mime.startsWith('image/') || mime === 'application/pdf' || mime.startsWith('audio/'));

    if (!url) return null;

    return (
        <>
            {canPreview && (
                <InlineAction type="button" onClick={() => setPreviewOpen(true)}>
                    <Eye size={13} /> Visualizar
                </InlineAction>
            )}
            <InlineAction as="a" href={url} target="_blank" rel="noreferrer">
                Abrir <ExternalLink size={12} />
            </InlineAction>
            {canPreview && (
                <Modal open={previewOpen} onOpenChange={setPreviewOpen} title={file.name}>
                    {mime.startsWith('image/') ? (
                        <img src={url} alt={file.name} style={{ maxWidth: '100%', maxHeight: '70vh', display: 'block', margin: '0 auto' }} />
                    ) : mime.startsWith('audio/') ? (
                        <audio src={url} controls style={{ width: '100%' }} />
                    ) : (
                        <iframe src={url} title={file.name} style={{ width: '100%', height: '70vh', border: 'none' }} />
                    )}
                </Modal>
            )}
        </>
    );
}

export function FilesTab({ eventId }: { eventId: string }) {
    const [modalOpen, setModalOpen] = useState(false);
    const [mode, setMode] = useState<'link' | 'upload' | 'record'>('link');
    const [file, setFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [renamingFile, setRenamingFile] = useState<EventFile | null>(null);
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const canManageFiles = hasPermission(user, 'events:manage');
    const { data: files } = useQuery({ queryKey: ['events', eventId, 'files'], queryFn: () => eventFilesApi.list(eventId) });
    const { register, handleSubmit, reset, watch } = useForm<{ name: string; externalUrl: string }>();
    const name = watch('name');
    const renameForm = useForm<{ name: string }>();

    const createMutation = useMutation({
        mutationFn: async (input: { name: string; externalUrl: string }) => {
            if (mode === 'upload' || mode === 'record') {
                if (!file) throw new Error(mode === 'record' ? 'Grave um áudio antes de salvar.' : 'Selecione um arquivo para enviar.');
                if (!EVENT_FILE_ALLOWED_TYPES.includes(file.type)) {
                    throw new Error('Tipo de arquivo não permitido. Envie PDF, DOC, DOCX, uma imagem ou um áudio.');
                }
                if (file.size > EVENT_FILE_MAX_SIZE) {
                    throw new Error('O arquivo deve ter no máximo 25MB.');
                }
                setIsUploading(true);
                try {
                    const { fileUrl, storageKey } = await mediaApi.upload(file, 'event-files');
                    return eventFilesApi.create(eventId, { name: input.name, storageKey, externalUrl: fileUrl, mimeType: file.type });
                } finally {
                    setIsUploading(false);
                }
            }
            return eventFilesApi.create(eventId, { name: input.name, externalUrl: input.externalUrl });
        },
        onSuccess: () => {
            toast.success('Arquivo adicionado.');
            queryClient.invalidateQueries({ queryKey: ['events', eventId, 'files'] });
            setModalOpen(false);
        },
        onError: (error: any) => toast.error(error?.response?.data?.message || error?.message || 'Não foi possível adicionar o arquivo.'),
    });

    const openModal = () => {
        reset({ name: '', externalUrl: '' });
        setMode('link');
        setFile(null);
        setModalOpen(true);
    };

    const canSubmit = mode === 'link' ? true : Boolean(file);

    const renameMutation = useMutation({
        mutationFn: (input: { name: string }) => eventFilesApi.update(eventId, renamingFile!.id, { name: input.name }),
        onSuccess: () => {
            toast.success('Arquivo renomeado.');
            queryClient.invalidateQueries({ queryKey: ['events', eventId, 'files'] });
            setRenamingFile(null);
        },
        onError: (error: any) => toast.error(error?.response?.data?.message || 'Não foi possível renomear o arquivo.'),
    });

    const removeMutation = useMutation({
        mutationFn: (fileId: string) => eventFilesApi.remove(eventId, fileId),
        onSuccess: () => {
            toast.success('Arquivo removido.');
            queryClient.invalidateQueries({ queryKey: ['events', eventId, 'files'] });
        },
        onError: (error: any) => toast.error(error?.response?.data?.message || 'Não foi possível remover o arquivo.'),
    });

    const openRenameModal = (f: EventFile) => {
        renameForm.reset({ name: f.name });
        setRenamingFile(f);
    };

    return (
        <>
            <TabBar>
                <span style={{ fontSize: '0.8125rem', color: '#6c757d' }}>
                    {(files ?? []).length === 0 ? 'Links e documentos do evento' : `${(files ?? []).length} arquivo${(files ?? []).length === 1 ? '' : 's'} e link${(files ?? []).length === 1 ? '' : 's'}`}
                </span>
                <Button onClick={openModal}><Plus size={16} /> Adicionar link/arquivo</Button>
            </TabBar>

            {(files ?? []).length === 0 ? (
                <EmptyState>Nenhum arquivo ou link anexado ainda.</EmptyState>
            ) : (
                <CompactList>
                    {(files ?? []).map((f) => {
                        const Icon = fileIcon(f.mimeType ?? '', Boolean(f.externalUrl));
                        return (
                            <CompactRow key={f.id}>
                                <TypeIcon><Icon size={16} /></TypeIcon>
                                <RowMain>
                                    <span className="title">{f.name}</span>
                                    <span className="meta">Adicionado em {formatAppDate(f.createdAt, 'dd/MM/yyyy')}</span>
                                </RowMain>
                                <FilePreview file={f} />
                                {canManageFiles && (
                                    <ActionMenu
                                        trigger={<MoreButton label={`Ações de ${f.name}`} />}
                                        entries={[
                                            { label: 'Renomear', icon: <Pencil size={14} />, onSelect: () => openRenameModal(f) },
                                            {
                                                label: 'Remover',
                                                icon: <Trash2 size={14} />,
                                                danger: true,
                                                onSelect: () => { if (window.confirm(`Remover o arquivo "${f.name}"?`)) removeMutation.mutate(f.id); },
                                            },
                                        ]}
                                    />
                                )}
                            </CompactRow>
                        );
                    })}
                </CompactList>
            )}

            <Modal open={modalOpen} onOpenChange={setModalOpen} title="Adicionar link/arquivo">
                <Form onSubmit={handleSubmit((data) => createMutation.mutate(data))}>
                    <Field>
                        <Label htmlFor="name">Nome</Label>
                        <Input id="name" placeholder="ex: Pauta da reunião" {...register('name', { required: true })} />
                    </Field>

                    <Field>
                        <Label htmlFor="mode">Tipo de anexo</Label>
                        <Select id="mode" value={mode} onChange={(e) => { setMode(e.target.value as 'link' | 'upload' | 'record'); setFile(null); }}>
                            <option value="link">Link (URL já hospedada)</option>
                            <option value="upload">Enviar arquivo</option>
                            <option value="record">Gravar áudio</option>
                        </Select>
                    </Field>

                    {mode === 'link' && (
                        <Field>
                            <Label htmlFor="externalUrl">Link</Label>
                            <Input id="externalUrl" placeholder="https://..." {...register('externalUrl', { required: mode === 'link' })} />
                        </Field>
                    )}
                    {mode === 'upload' && (
                        <Field>
                            <Label htmlFor="file">Arquivo</Label>
                            <input
                                id="file"
                                type="file"
                                accept={EVENT_FILE_ALLOWED_TYPES.join(',')}
                                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                            />
                            <HelpText>PDF, DOC, DOCX ou imagem, até 25MB.</HelpText>
                        </Field>
                    )}
                    {mode === 'record' && (
                        <Field>
                            <Label>Áudio</Label>
                            <AudioRecorder onRecorded={setFile} disabled={createMutation.isPending} />
                        </Field>
                    )}

                    <FormActions>
                        <Button type="button" $variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
                        <Button type="submit" disabled={!name || !canSubmit || createMutation.isPending}>
                            {isUploading ? 'Enviando...' : createMutation.isPending ? 'Salvando...' : 'Adicionar'}
                        </Button>
                    </FormActions>
                </Form>
            </Modal>

            <Modal open={!!renamingFile} onOpenChange={(open) => !open && setRenamingFile(null)} title="Renomear arquivo">
                <Form onSubmit={renameForm.handleSubmit((data) => renameMutation.mutate(data))}>
                    <Field>
                        <Label htmlFor="rename-name">Nome</Label>
                        <Input id="rename-name" {...renameForm.register('name', { required: true })} />
                    </Field>
                    <FormActions>
                        <Button type="button" $variant="secondary" onClick={() => setRenamingFile(null)}>Cancelar</Button>
                        <Button type="submit" disabled={renameMutation.isPending}>
                            {renameMutation.isPending ? 'Salvando...' : 'Salvar'}
                        </Button>
                    </FormActions>
                </Form>
            </Modal>
        </>
    );
}
