// frontend/src/pages/admin/EmailTemplateEditor.tsx
//
// Hospeda o construtor visual de e-mails (EmailBuilder, portado de
// MaskotCrmEdu) para editar o designJson de um EmailTemplate específico.
// O backend deriva `body` (HTML) automaticamente a partir de `designJson` —
// esta tela só precisa mandar `{ subject, designJson }` no PATCH.

import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Popover from '@radix-ui/react-popover';
import { GearSix } from 'phosphor-react';
import styled from 'styled-components';

import { EmailBuilder } from '@/components/email-builder/EmailBuilder';
import { EmailBuilderErrorBoundary } from '@/components/email-builder/EmailBuilderErrorBoundary';
import type { ExtendedBlock, GlobalEmailSettings } from '@/components/email-builder/types';
import { TemplateNameInput, IconButton, AlertDot } from '@/components/email-builder/styles';
import { emailTemplatesApi } from '@/services/emailTemplates';
import { toast } from '@/utils/toast';

const PopoverContent = styled(Popover.Content)`
    background: white;
    border: 1px solid #e4e9f1;
    border-radius: 10px;
    box-shadow: 0 10px 38px -10px rgba(22, 23, 24, 0.35), 0 10px 20px -15px rgba(22, 23, 24, 0.2);
    padding: 16px;
    width: 320px;
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

const LoadingWrapper = styled.div`
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 60vh;
    color: #64748b;
    font-size: 14px;
`;

export default function EmailTemplateEditor() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const { data: template, isLoading } = useQuery({
        queryKey: ['email-templates', id],
        queryFn: () => emailTemplatesApi.get(id!),
        enabled: !!id,
    });

    const [subject, setSubject] = useState('');
    const [editorData, setEditorData] = useState<{ blocks: ExtendedBlock[]; settings: GlobalEmailSettings | undefined }>({
        blocks: [],
        settings: undefined,
    });
    const [isInitialized, setIsInitialized] = useState(false);

    // Inicializa o estado local só uma vez, quando o template chega do backend
    // (o próprio EmailBuilder gerencia o estado dos blocos depois disso).
    useEffect(() => {
        if (template && !isInitialized) {
            setSubject(template.subject || '');
            const designJson = (template.designJson || {}) as { blocks?: ExtendedBlock[]; globalSettings?: GlobalEmailSettings };
            setEditorData({
                blocks: Array.isArray(designJson.blocks) ? designJson.blocks : [],
                settings: designJson.globalSettings,
            });
            setIsInitialized(true);
        }
    }, [template, isInitialized]);

    const updateMutation = useMutation({
        mutationFn: () =>
            emailTemplatesApi.update(id!, {
                subject,
                designJson: {
                    blocks: editorData.blocks,
                    globalSettings: editorData.settings,
                },
            }),
        onSuccess: () => {
            toast.success('Template salvo com sucesso.');
            queryClient.invalidateQueries({ queryKey: ['email-templates'] });
            queryClient.invalidateQueries({ queryKey: ['email-templates', id] });
        },
        onError: (error: any) => {
            toast.error(error?.response?.data?.message || 'Não foi possível salvar o template.');
        },
    });

    const sendTestMutation = useMutation({
        mutationFn: (to: string) => emailTemplatesApi.sendTest(id!, to),
        onSuccess: () => {
            toast.success('E-mail de teste enviado.');
        },
        onError: (error: any) => {
            toast.error(error?.response?.data?.message || 'Falha ao enviar e-mail de teste.');
        },
    });

    const handleEditorChange = (blocks: ExtendedBlock[], settings: GlobalEmailSettings) => {
        setEditorData({ blocks, settings });
    };

    const handleSendTest = () => {
        const to = window.prompt('Enviar e-mail de teste para qual endereço?');
        if (to) sendTestMutation.mutate(to);
    };

    if (isLoading || !isInitialized) {
        return <LoadingWrapper>Carregando template...</LoadingWrapper>;
    }

    return (
        <EmailBuilderErrorBoundary>
            <EmailBuilder
                key={id}
                initialBlocks={editorData.blocks}
                initialSettings={editorData.settings}
                onChange={handleEditorChange}
                onSendTest={handleSendTest}
                isNewTemplate={false}
                onBack={() => navigate('/admin/email-templates')}
                headerTitle={
                    <TemplateNameInput
                        value={template?.name || ''}
                        readOnly
                        title="Nome do template (definido na criação)"
                        aria-label="Nome do template"
                    />
                }
                headerSettings={
                    <Popover.Root>
                        <Popover.Trigger asChild>
                            <IconButton type="button" aria-label="Configurações do e-mail" title="Configurações do e-mail">
                                <GearSix size={18} />
                                {!subject && <AlertDot />}
                            </IconButton>
                        </Popover.Trigger>
                        <Popover.Portal>
                            <PopoverContent sideOffset={8} align="end" collisionPadding={12}>
                                <PopoverTitle>Configurações do e-mail</PopoverTitle>
                                <PopoverField>
                                    <PopoverLabel htmlFor="email-subject">Assunto</PopoverLabel>
                                    <PopoverInput
                                        id="email-subject"
                                        value={subject}
                                        onChange={(e) => setSubject(e.target.value)}
                                        placeholder="Assunto do e-mail"
                                    />
                                </PopoverField>
                            </PopoverContent>
                        </Popover.Portal>
                    </Popover.Root>
                }
                headerActions={
                    <button
                        type="button"
                        onClick={() => updateMutation.mutate()}
                        disabled={updateMutation.isPending}
                        style={{
                            height: 36,
                            padding: '0 18px',
                            border: 'none',
                            borderRadius: 8,
                            background: '#007bff',
                            color: '#fff',
                            fontSize: 13,
                            fontWeight: 600,
                            cursor: updateMutation.isPending ? 'not-allowed' : 'pointer',
                            opacity: updateMutation.isPending ? 0.7 : 1,
                        }}
                    >
                        {updateMutation.isPending ? 'Salvando...' : 'Salvar'}
                    </button>
                }
            />
        </EmailBuilderErrorBoundary>
    );
}
