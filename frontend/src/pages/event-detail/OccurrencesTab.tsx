// frontend/src/pages/event-detail/OccurrencesTab.tsx
//
// Aba Ocorrências: lista compacta (uma linha por relatório, com filtro por tipo) e ações atrás de
// um "⋯". Registrar é aberto a todos; editar exige ser o autor ou `events:manage`; remover exige
// `events:manage`.

import { useState } from 'react';
import { Plus, Paperclip, Pencil, Trash2, Volume2, ExternalLink, Stethoscope, ShieldAlert, Users, FileText, type LucideIcon } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/Button';
import { ActionMenu, MoreButton, type MenuEntry } from '@/components/ui/ActionMenu';
import { Modal } from '@/components/ui/Modal';
import { Field, Label, Input, Select, Textarea, Form, FormActions, HelpText } from '@/components/ui/FormField';
import { Table, TableWrapper, Thead, Tr, Th, Td, EmptyState } from '@/components/ui/Table';
import { AudioRecorder } from '@/components/media/AudioRecorder';
import { occurrenceReportsApi, occurrenceReportFilesApi, type OccurrenceReport, type OccurrenceReportFile } from '@/services/events';
import { mediaApi } from '@/services/media';
import { toast } from '@/utils/toast';
import { useAuth } from '@/contexts/AuthContext';
import { hasPermission } from '@/utils/permissions';
import { formatAppDate } from '@/utils/datetime';
import { FilterChip } from '@/pages/course-detail/styles';
import { TabBar, BarGroup, CompactList, CompactRow, RowMain, InlineAction, TypeIcon } from './ListParts';

const OCCURRENCE_TYPES = [
    { value: 'MEDICAL', label: 'Médica' },
    { value: 'SAFETY', label: 'Segurança' },
    { value: 'BEHAVIORAL', label: 'Comportamental' },
    { value: 'GENERAL', label: 'Geral' },
];

const TYPE_ICON: Record<string, LucideIcon> = { MEDICAL: Stethoscope, SAFETY: ShieldAlert, BEHAVIORAL: Users, GENERAL: FileText };

function OccurrenceAudioPlayer({ url }: { url: string }) {
    const [open, setOpen] = useState(false);
    return (
        <>
            <InlineAction type="button" onClick={() => setOpen(true)}>
                <Volume2 size={13} /> Ouvir
            </InlineAction>
            <Modal open={open} onOpenChange={setOpen} title="Áudio da ocorrência">
                <audio src={url} controls style={{ width: '100%' }} />
            </Modal>
        </>
    );
}

const OCCURRENCE_FILE_ALLOWED_TYPES = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/svg+xml',
];
const OCCURRENCE_FILE_MAX_SIZE = 25 * 1024 * 1024; // 25MB — mesmo padrão de media.service.ts

export function OccurrencesTab({ eventId }: { eventId: string }) {
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<OccurrenceReport | null>(null);
    const [audioFile, setAudioFile] = useState<File | null>(null);
    const [isUploadingAudio, setIsUploadingAudio] = useState(false);
    const [typeFilter, setTypeFilter] = useState<string>('all');
    const [attachmentsFor, setAttachmentsFor] = useState<OccurrenceReport | null>(null);
    const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
    const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
    const queryClient = useQueryClient();
    const { user } = useAuth();
    // Registrar é aberto a todo mundo (quem está em campo percebe o incidente), mas
    // remover um relatório já registrado exige events:manage no backend.
    const canRemove = hasPermission(user, 'events:manage');
    const canEditReport = (r: OccurrenceReport) => r.createdByUserId === user?.id || canRemove;
    const { data: reports } = useQuery({ queryKey: ['events', eventId, 'occurrence-reports'], queryFn: () => occurrenceReportsApi.list(eventId) });
    const { register, handleSubmit, reset } = useForm<{ type: string; title: string; description: string }>();

    const saveMutation = useMutation({
        mutationFn: async (input: { type: string; title: string; description?: string }) => {
            let audioUrl = editing?.audioUrl ?? undefined;
            if (audioFile) {
                setIsUploadingAudio(true);
                try {
                    const { fileUrl } = await mediaApi.upload(audioFile, 'occurrence-audio');
                    audioUrl = fileUrl;
                } finally {
                    setIsUploadingAudio(false);
                }
            }
            return editing
                ? occurrenceReportsApi.update(eventId, editing.id, { ...input, audioUrl })
                : occurrenceReportsApi.create(eventId, { ...input, audioUrl });
        },
        onSuccess: () => {
            toast.success(editing ? 'Relatório atualizado.' : 'Relatório registrado.');
            queryClient.invalidateQueries({ queryKey: ['events', eventId, 'occurrence-reports'] });
            setModalOpen(false);
            setAudioFile(null);
            setEditing(null);
        },
        onError: (error: any) =>
            toast.error(error?.response?.data?.message || (editing ? 'Não foi possível atualizar o relatório.' : 'Não foi possível registrar o relatório.')),
    });

    const removeMutation = useMutation({
        mutationFn: (reportId: string) => occurrenceReportsApi.remove(eventId, reportId),
        onSuccess: () => {
            toast.success('Relatório removido.');
            queryClient.invalidateQueries({ queryKey: ['events', eventId, 'occurrence-reports'] });
        },
        onError: (error: any) => toast.error(error?.response?.data?.message || 'Não foi possível remover o relatório.'),
    });

    const { data: attachments } = useQuery({
        queryKey: ['events', eventId, 'occurrence-reports', attachmentsFor?.id, 'files'],
        queryFn: () => occurrenceReportFilesApi.list(eventId, attachmentsFor!.id),
        enabled: !!attachmentsFor,
    });

    const addAttachmentMutation = useMutation({
        mutationFn: async () => {
            if (!attachmentFile || !attachmentsFor) throw new Error('Selecione um arquivo.');
            if (!OCCURRENCE_FILE_ALLOWED_TYPES.includes(attachmentFile.type)) {
                throw new Error('Tipo de arquivo não permitido. Envie PDF, DOC, DOCX ou uma imagem.');
            }
            if (attachmentFile.size > OCCURRENCE_FILE_MAX_SIZE) {
                throw new Error('O arquivo deve ter no máximo 25MB.');
            }
            setIsUploadingAttachment(true);
            try {
                const { fileUrl, storageKey } = await mediaApi.upload(attachmentFile, 'occurrence-files');
                return occurrenceReportFilesApi.create(eventId, attachmentsFor.id, {
                    name: attachmentFile.name,
                    storageKey,
                    externalUrl: fileUrl,
                    mimeType: attachmentFile.type,
                });
            } finally {
                setIsUploadingAttachment(false);
            }
        },
        onSuccess: () => {
            toast.success('Arquivo anexado.');
            queryClient.invalidateQueries({ queryKey: ['events', eventId, 'occurrence-reports', attachmentsFor?.id, 'files'] });
            setAttachmentFile(null);
        },
        onError: (error: any) => toast.error(error?.response?.data?.message || error?.message || 'Não foi possível anexar o arquivo.'),
    });

    const removeAttachmentMutation = useMutation({
        mutationFn: (fileId: string) => occurrenceReportFilesApi.remove(eventId, attachmentsFor!.id, fileId),
        onSuccess: () => {
            toast.success('Anexo removido.');
            queryClient.invalidateQueries({ queryKey: ['events', eventId, 'occurrence-reports', attachmentsFor?.id, 'files'] });
        },
        onError: (error: any) => toast.error(error?.response?.data?.message || 'Não foi possível remover o anexo.'),
    });

    const canEditAttachments = attachmentsFor ? canEditReport(attachmentsFor) : false;

    const all = reports ?? [];
    const countByType = (type: string) => all.filter((r) => r.type === type).length;
    const listed = typeFilter === 'all' ? all : all.filter((r) => r.type === typeFilter);

    const openNew = () => {
        reset({ type: 'GENERAL', title: '', description: '' });
        setAudioFile(null);
        setEditing(null);
        setModalOpen(true);
    };
    const openEdit = (r: OccurrenceReport) => {
        reset({ type: r.type, title: r.title, description: r.description ?? '' });
        setAudioFile(null);
        setEditing(r);
        setModalOpen(true);
    };

    return (
        <>
            <TabBar>
                <BarGroup>
                    {all.length > 0 && (
                        <>
                            <FilterChip type="button" $active={typeFilter === 'all'} onClick={() => setTypeFilter('all')}>Todas ({all.length})</FilterChip>
                            {OCCURRENCE_TYPES.filter((t) => countByType(t.value) > 0).map((t) => (
                                <FilterChip key={t.value} type="button" $active={typeFilter === t.value} onClick={() => setTypeFilter(t.value)}>
                                    {t.label} ({countByType(t.value)})
                                </FilterChip>
                            ))}
                        </>
                    )}
                </BarGroup>
                <Button onClick={openNew}><Plus size={16} /> Novo relatório</Button>
            </TabBar>

            {all.length === 0 ? (
                <EmptyState>Nenhum relatório de ocorrência registrado.</EmptyState>
            ) : (
                <CompactList>
                    {listed.map((r) => {
                        const Icon = TYPE_ICON[r.type] ?? FileText;
                        const entries: MenuEntry[] = [{ label: 'Anexos', icon: <Paperclip size={14} />, onSelect: () => setAttachmentsFor(r) }];
                        if (canEditReport(r)) entries.push({ label: 'Editar', icon: <Pencil size={14} />, onSelect: () => openEdit(r) });
                        if (canRemove) {
                            entries.push({
                                label: 'Remover',
                                icon: <Trash2 size={14} />,
                                danger: true,
                                onSelect: () => { if (window.confirm(`Remover o relatório "${r.title}"?`)) removeMutation.mutate(r.id); },
                            });
                        }
                        return (
                            <CompactRow key={r.id}>
                                <TypeIcon title={OCCURRENCE_TYPES.find((t) => t.value === r.type)?.label ?? r.type}><Icon size={16} /></TypeIcon>
                                <RowMain>
                                    <span className="title">{r.title}</span>
                                    {r.description && <span className="desc">{r.description}</span>}
                                    <span className="meta">
                                        {OCCURRENCE_TYPES.find((t) => t.value === r.type)?.label ?? r.type} · {r.createdBy.name} · {formatAppDate(r.createdAt, 'dd/MM/yyyy HH:mm')}
                                    </span>
                                </RowMain>
                                {r.audioUrl && <OccurrenceAudioPlayer url={r.audioUrl} />}
                                <ActionMenu trigger={<MoreButton label={`Ações de ${r.title}`} />} entries={entries} />
                            </CompactRow>
                        );
                    })}
                    {listed.length === 0 && <CompactRow><RowMain><span className="meta">Nenhuma ocorrência desse tipo.</span></RowMain></CompactRow>}
                </CompactList>
            )}

            <Modal
                open={modalOpen}
                onOpenChange={setModalOpen}
                title={editing ? 'Editar relatório de ocorrência' : 'Novo relatório de ocorrência'}
            >
                <Form onSubmit={handleSubmit((data) => saveMutation.mutate(data))}>
                    <Field>
                        <Label htmlFor="type">Tipo</Label>
                        <Select id="type" {...register('type', { required: true })}>
                            {OCCURRENCE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </Select>
                    </Field>
                    <Field>
                        <Label htmlFor="title">Título</Label>
                        <Input id="title" {...register('title', { required: true })} />
                    </Field>
                    <Field>
                        <Label htmlFor="description">Descrição</Label>
                        <Textarea id="description" {...register('description')} />
                    </Field>
                    <Field>
                        <Label>Áudio (opcional)</Label>
                        {editing?.audioUrl && !audioFile && (
                            <div style={{ marginBottom: 8 }}>
                                <OccurrenceAudioPlayer url={editing.audioUrl} />
                                <HelpText>Grave um novo áudio abaixo para substituir o atual.</HelpText>
                            </div>
                        )}
                        <AudioRecorder onRecorded={setAudioFile} disabled={saveMutation.isPending} />
                    </Field>
                    <FormActions>
                        <Button type="button" $variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
                        <Button type="submit" disabled={saveMutation.isPending}>
                            {isUploadingAudio ? 'Enviando áudio...' : saveMutation.isPending ? 'Salvando...' : editing ? 'Salvar' : 'Registrar'}
                        </Button>
                    </FormActions>
                </Form>
            </Modal>

            <Modal
                open={!!attachmentsFor}
                onOpenChange={(open) => !open && setAttachmentsFor(null)}
                title={`Anexos — ${attachmentsFor?.title ?? ''}`}
            >
                <TableWrapper>
                    <Table>
                        <Thead><tr><Th>Nome</Th><Th>Link</Th>{canEditAttachments && <Th></Th>}</tr></Thead>
                        <tbody>
                            {(attachments ?? []).map((f: OccurrenceReportFile) => (
                                <Tr key={f.id}>
                                    <Td>{f.name}</Td>
                                    <Td>
                                        {f.externalUrl ? (
                                            <a href={f.externalUrl} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                                Abrir <ExternalLink size={12} />
                                            </a>
                                        ) : '—'}
                                    </Td>
                                    {canEditAttachments && (
                                        <Td>
                                            <Button
                                                $variant="ghost"
                                                onClick={() => {
                                                    if (window.confirm(`Remover o anexo "${f.name}"?`)) {
                                                        removeAttachmentMutation.mutate(f.id);
                                                    }
                                                }}
                                            >
                                                <Trash2 size={14} />
                                            </Button>
                                        </Td>
                                    )}
                                </Tr>
                            ))}
                        </tbody>
                    </Table>
                    {(attachments ?? []).length === 0 && <EmptyState>Nenhum arquivo anexado ainda.</EmptyState>}
                </TableWrapper>

                {canEditAttachments && (
                    <Form onSubmit={(e) => { e.preventDefault(); addAttachmentMutation.mutate(); }} style={{ marginTop: '1rem' }}>
                        <Field>
                            <Label htmlFor="attachment-file">Anexar novo arquivo</Label>
                            <input
                                id="attachment-file"
                                type="file"
                                accept={OCCURRENCE_FILE_ALLOWED_TYPES.join(',')}
                                onChange={(e) => setAttachmentFile(e.target.files?.[0] ?? null)}
                            />
                            <HelpText>PDF, DOC, DOCX ou imagem, até 25MB.</HelpText>
                        </Field>
                        <FormActions>
                            <Button type="submit" disabled={!attachmentFile || addAttachmentMutation.isPending}>
                                {isUploadingAttachment ? 'Enviando...' : addAttachmentMutation.isPending ? 'Salvando...' : 'Anexar'}
                            </Button>
                        </FormActions>
                    </Form>
                )}
            </Modal>
        </>
    );
}
