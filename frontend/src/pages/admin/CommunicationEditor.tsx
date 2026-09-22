// frontend/src/pages/admin/CommunicationEditor.tsx
//
// Hospeda o construtor visual de e-mails (EmailBuilder, o mesmo de EmailTemplateEditor.tsx)
// pra escrever um "comunicado" (e-mail avulso pra pessoas da academia). Diferenças pro editor
// de template: tem um seletor de público-alvo (Destinatários) no popover de configurações, os
// botões de ação viram "Salvar rascunho"/"Enviar", e depois de enviado (status !== DRAFT) tudo
// fica somente leitura com uma tabela de "Detalhes de envio" (quem recebeu, quem abriu).

import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Popover from '@radix-ui/react-popover';
import { GearSix } from 'phosphor-react';
import styled from 'styled-components';

import { ArrowLeft } from 'lucide-react';
import { EmailBuilder } from '@/components/email-builder/EmailBuilder';
import { EmailBuilderErrorBoundary } from '@/components/email-builder/EmailBuilderErrorBoundary';
import type { ExtendedBlock, GlobalEmailSettings } from '@/components/email-builder/types';
import { TemplateNameInput, IconButton, AlertDot } from '@/components/email-builder/styles';
import { PageLayout } from '@/components/layout/PageLayout';
import { communicationsApi, type CommunicationAudience } from '@/services/communications';
import { peopleApi } from '@/services/people';
import { Table, TableWrapper, Thead, Tr, Th, Td, Badge } from '@/components/ui/Table';
import { formatAppDate } from '@/utils/datetime';
import { toast } from '@/utils/toast';

const PopoverContent = styled(Popover.Content)`
    background: white;
    border: 1px solid #e4e9f1;
    border-radius: 10px;
    box-shadow: 0 10px 38px -10px rgba(22, 23, 24, 0.35), 0 10px 20px -15px rgba(22, 23, 24, 0.2);
    padding: 16px;
    width: 340px;
    max-height: 80vh;
    overflow-y: auto;
    z-index: 10010;
`;

const PopoverTitle = styled.h4`
    margin: 0 0 12px 0;
    font-size: 13px;
    font-weight: 700;
    color: #18202f;
`;

const PopoverField = styled.div`
    margin-bottom: 12px;

    &:last-child {
        margin-bottom: 0;
    }
`;

const PopoverLabel = styled.label`
    display: block;
    font-size: 12px;
    font-weight: 600;
    color: #47536b;
    margin-bottom: 4px;
`;

const PopoverInput = styled.input`
    width: 100%;
    height: 36px;
    padding: 0 10px;
    border: 1px solid #e4e9f1;
    border-radius: 6px;
    font-size: 13px;

    &:focus {
        outline: none;
        border-color: #007bff;
    }
`;

const RadioOption = styled.label`
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 12.5px;
    color: #333c4e;
    padding: 4px 0;
    cursor: pointer;
`;

const CheckList = styled.div`
    max-height: 180px;
    overflow-y: auto;
    border: 1px solid #e4e9f1;
    border-radius: 6px;
    padding: 6px 8px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 12.5px;
    margin-top: 6px;
`;

const LoadingWrapper = styled.div`
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 60vh;
    color: #64748b;
    font-size: 14px;
`;

const BackLink = styled.button`
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    background: none;
    border: none;
    color: ${({ theme }) => theme.colors.textMuted};
    font-size: 0.8125rem;
    cursor: pointer;
    padding: 0;
    margin-bottom: 0.75rem;
`;

const ReadOnlyBanner = styled.div`
    padding: 0.9rem 1.25rem;
    background: #eef6ff;
    border: 1px solid #d8e8fb;
    border-radius: ${({ theme }) => theme.radii.sm};
    font-size: 0.8125rem;
    color: #1c3a5e;
    margin-bottom: 1.25rem;
`;

const PreviewFrame = styled.iframe`
    width: 100%;
    height: 480px;
    border: 1px solid ${({ theme }) => theme.colors.borderLight};
    border-radius: ${({ theme }) => theme.radii.sm};
    margin-bottom: 1.25rem;
    background: #fff;
`;

const SectionTitle = styled.h3`
    font-size: 0.9rem;
    margin-bottom: 0.75rem;
`;

const AUDIENCE_LABEL: Record<CommunicationAudience, string> = {
    ALL: 'Todas as pessoas ativas da academia',
    STUDENTS: 'Somente alunos',
    STAFF: 'Somente equipe',
    CUSTOM: 'Pessoas específicas',
};

const STATUS_LABEL: Record<string, string> = { PENDING: 'Pendente', SENT: 'Enviado', FAILED: 'Falhou' };
const STATUS_TONE: Record<string, 'neutral' | 'success' | 'danger'> = { PENDING: 'neutral', SENT: 'success', FAILED: 'danger' };

export default function CommunicationEditor() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const { data: communication, isLoading } = useQuery({
        queryKey: ['communications', id],
        queryFn: () => communicationsApi.get(id!),
        enabled: !!id,
    });

    const { data: peopleData } = useQuery({
        queryKey: ['people', 'for-communication-picker'],
        queryFn: () => peopleApi.list({ limit: 500 }),
    });
    const people = peopleData?.data ?? [];

    const [subject, setSubject] = useState('');
    const [audience, setAudience] = useState<CommunicationAudience>('ALL');
    const [customRecipientUserIds, setCustomRecipientUserIds] = useState<string[]>([]);
    const [peopleSearch, setPeopleSearch] = useState('');
    const [editorData, setEditorData] = useState<{ blocks: ExtendedBlock[]; settings: GlobalEmailSettings | undefined }>({
        blocks: [],
        settings: undefined,
    });
    const [isInitialized, setIsInitialized] = useState(false);

    useEffect(() => {
        if (communication && !isInitialized) {
            setSubject(communication.subject || '');
            setAudience(communication.audience);
            setCustomRecipientUserIds(communication.customRecipientUserIds ?? []);
            const designJson = (communication.designJson || {}) as { blocks?: ExtendedBlock[]; globalSettings?: GlobalEmailSettings };
            setEditorData({
                blocks: Array.isArray(designJson.blocks) ? designJson.blocks : [],
                settings: designJson.globalSettings,
            });
            setIsInitialized(true);
        }
    }, [communication, isInitialized]);

    const isDraft = communication?.status === 'DRAFT';

    const recipientCount = useMemo(() => {
        const active = people.filter((p) => p.isActive);
        if (audience === 'STUDENTS') return active.filter((p) => p.studentProfile).length;
        if (audience === 'STAFF') return active.filter((p) => p.staffMember?.status === 'ACTIVE').length;
        if (audience === 'CUSTOM') return customRecipientUserIds.length;
        return active.length;
    }, [people, audience, customRecipientUserIds]);

    const filteredPeople = useMemo(() => {
        const term = peopleSearch.trim().toLowerCase();
        if (!term) return people;
        return people.filter((p) => p.name.toLowerCase().includes(term) || p.email.toLowerCase().includes(term));
    }, [people, peopleSearch]);

    const toggleCustomRecipient = (userId: string) => {
        setCustomRecipientUserIds((prev) => (prev.includes(userId) ? prev.filter((x) => x !== userId) : [...prev, userId]));
    };

    const updateMutation = useMutation({
        mutationFn: () =>
            communicationsApi.update(id!, {
                subject,
                audience,
                customRecipientUserIds,
                designJson: { blocks: editorData.blocks, globalSettings: editorData.settings },
            }),
        onSuccess: () => {
            toast.success('Rascunho salvo com sucesso.');
            queryClient.invalidateQueries({ queryKey: ['communications'] });
            queryClient.invalidateQueries({ queryKey: ['communications', id] });
        },
        onError: (error: any) => toast.error(error?.response?.data?.message || 'Não foi possível salvar o rascunho.'),
    });

    const sendMutation = useMutation({
        mutationFn: () => communicationsApi.send(id!),
        onSuccess: (result) => {
            toast.success(`Envio iniciado para ${result.recipientCount} pessoa(s).`);
            queryClient.invalidateQueries({ queryKey: ['communications'] });
            navigate('/admin/emails?tab=communications');
        },
        onError: (error: any) => toast.error(error?.response?.data?.message || 'Não foi possível enviar o comunicado.'),
    });

    const sendTestMutation = useMutation({
        mutationFn: (to: string) => communicationsApi.sendTest(id!, to),
        onSuccess: () => toast.success('E-mail de teste enviado.'),
        onError: (error: any) => toast.error(error?.response?.data?.message || 'Falha ao enviar e-mail de teste.'),
    });

    const handleEditorChange = (blocks: ExtendedBlock[], settings: GlobalEmailSettings) => {
        setEditorData({ blocks, settings });
    };

    const handleSendTest = () => {
        const to = window.prompt('Enviar e-mail de teste para qual endereço?');
        if (to) sendTestMutation.mutate(to);
    };

    const handleSend = async () => {
        await updateMutation.mutateAsync();
        const confirmed = window.confirm(
            `Enviar este comunicado para ${recipientCount} pessoa(s) (${AUDIENCE_LABEL[audience]})? Depois de enviado não é mais possível editar.`,
        );
        if (confirmed) sendMutation.mutate();
    };

    if (isLoading || !isInitialized || !communication) {
        return <LoadingWrapper>Carregando comunicado...</LoadingWrapper>;
    }

    if (!isDraft) {
        const recipients = communication.recipients ?? [];
        return (
            <PageLayout title={communication.subject || '(sem assunto)'} subtitle={`Criado por ${communication.createdBy?.name ?? '—'} em ${formatAppDate(communication.createdAt, 'dd/MM/yyyy HH:mm')}`}>
                <BackLink onClick={() => navigate('/admin/emails?tab=communications')}>
                    <ArrowLeft size={14} /> Voltar para comunicados
                </BackLink>

                <ReadOnlyBanner>
                    Enviado {communication.sentAt ? `em ${formatAppDate(communication.sentAt, 'dd/MM/yyyy HH:mm')}` : ''} para{' '}
                    {communication.recipientCount} destinatário(s)
                    {communication.failedCount > 0 ? `, ${communication.failedCount} falharam` : ''}, {communication.openedCount} abriram.
                </ReadOnlyBanner>

                <SectionTitle>Conteúdo enviado</SectionTitle>
                <PreviewFrame title="Pré-visualização do e-mail enviado" srcDoc={communication.body} sandbox="" />

                <SectionTitle>Detalhes de envio</SectionTitle>
                <TableWrapper>
                    <Table>
                        <Thead>
                            <tr>
                                <Th>Nome</Th>
                                <Th>E-mail</Th>
                                <Th>Status</Th>
                                <Th>Enviado em</Th>
                                <Th>Aberto em</Th>
                            </tr>
                        </Thead>
                        <tbody>
                            {recipients.map((r) => (
                                <Tr key={r.id}>
                                    <Td>{r.name}</Td>
                                    <Td>{r.email}</Td>
                                    <Td><Badge $tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Badge></Td>
                                    <Td>{r.sentAt ? formatAppDate(r.sentAt, 'dd/MM/yyyy HH:mm') : '—'}</Td>
                                    <Td>{r.openedAt ? formatAppDate(r.openedAt, 'dd/MM/yyyy HH:mm') : 'Não abriu'}</Td>
                                </Tr>
                            ))}
                        </tbody>
                    </Table>
                </TableWrapper>
            </PageLayout>
        );
    }

    return (
        <div>
            <EmailBuilderErrorBoundary>
                <EmailBuilder
                    key={id}
                    initialBlocks={editorData.blocks}
                    initialSettings={editorData.settings}
                    onChange={handleEditorChange}
                    onSendTest={handleSendTest}
                    isNewTemplate={false}
                    onBack={() => navigate('/admin/emails?tab=communications')}
                    headerTitle={
                        <TemplateNameInput
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                            placeholder="Assunto do e-mail"
                            aria-label="Assunto do comunicado"
                        />
                    }
                    headerSettings={
                        <Popover.Root>
                            <Popover.Trigger asChild>
                                <IconButton type="button" aria-label="Destinatários" title="Destinatários">
                                    <GearSix size={18} />
                                    {(!subject || recipientCount === 0) && <AlertDot />}
                                </IconButton>
                            </Popover.Trigger>
                            <Popover.Portal>
                                <PopoverContent sideOffset={8} align="end" collisionPadding={12}>
                                    <PopoverTitle>Destinatários</PopoverTitle>
                                    <PopoverField>
                                        {(Object.keys(AUDIENCE_LABEL) as CommunicationAudience[]).map((value) => (
                                            <RadioOption key={value}>
                                                <input
                                                    type="radio"
                                                    name="audience"
                                                    checked={audience === value}
                                                    onChange={() => setAudience(value)}
                                                />
                                                {AUDIENCE_LABEL[value]}
                                            </RadioOption>
                                        ))}
                                    </PopoverField>

                                    {audience === 'CUSTOM' && (
                                        <PopoverField>
                                            <PopoverInput
                                                placeholder="Buscar por nome ou e-mail..."
                                                value={peopleSearch}
                                                onChange={(e) => setPeopleSearch(e.target.value)}
                                            />
                                            <CheckList>
                                                {filteredPeople.map((p) => (
                                                    <RadioOption key={p.id}>
                                                        <input
                                                            type="checkbox"
                                                            checked={customRecipientUserIds.includes(p.id)}
                                                            onChange={() => toggleCustomRecipient(p.id)}
                                                        />
                                                        {p.name}
                                                    </RadioOption>
                                                ))}
                                                {filteredPeople.length === 0 && <span>Nenhuma pessoa encontrada.</span>}
                                            </CheckList>
                                        </PopoverField>
                                    )}

                                    <PopoverField>
                                        <small>{recipientCount} destinatário(s) no total.</small>
                                    </PopoverField>
                                </PopoverContent>
                            </Popover.Portal>
                        </Popover.Root>
                    }
                    headerActions={
                        <>
                            <button
                                type="button"
                                onClick={() => updateMutation.mutate()}
                                disabled={updateMutation.isPending}
                                style={{
                                    height: 36,
                                    padding: '0 18px',
                                    marginRight: 8,
                                    border: '1px solid #e4e9f1',
                                    borderRadius: 8,
                                    background: '#fff',
                                    color: '#333c4e',
                                    fontSize: 13,
                                    fontWeight: 600,
                                    cursor: updateMutation.isPending ? 'not-allowed' : 'pointer',
                                }}
                            >
                                {updateMutation.isPending ? 'Salvando...' : 'Salvar rascunho'}
                            </button>
                            <button
                                type="button"
                                onClick={handleSend}
                                disabled={sendMutation.isPending || updateMutation.isPending}
                                style={{
                                    height: 36,
                                    padding: '0 18px',
                                    border: 'none',
                                    borderRadius: 8,
                                    background: '#007bff',
                                    color: '#fff',
                                    fontSize: 13,
                                    fontWeight: 600,
                                    cursor: sendMutation.isPending ? 'not-allowed' : 'pointer',
                                    opacity: sendMutation.isPending ? 0.7 : 1,
                                }}
                            >
                                {sendMutation.isPending ? 'Enviando...' : 'Enviar'}
                            </button>
                        </>
                    }
                />
            </EmailBuilderErrorBoundary>
        </div>
    );
}
