// frontend/src/pages/certificates/DesignsModal.tsx
//
// Modelos de certificado da academia: criar (a partir de um modelo pronto ou de
// uma cópia), editar no editor visual, escolher o padrão e excluir. O padrão vale
// para as turmas que não escolheram um modelo (Editar turma → Certificado).

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, Pencil, Plus, Star, Trash2 } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Table';
import { Field, Label, Input, Select, HelpText } from '@/components/ui/FormField';
import { certificateDesignsApi, type CertificateDesign } from '@/services/certificates';
import { toast } from '@/utils/toast';
import { certificateErrorMessage } from './PdfPreview';
import { MiniLayout } from './editor/MiniLayout';
import { useCertificateRenderContext } from './editor/useCertificateRenderContext';

const Grid = styled.div`
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
    gap: 0.75rem;
`;

const Card = styled.div<{ $default: boolean }>`
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.6rem;
    border: 1.5px solid ${({ $default, theme }) => ($default ? theme.colors.primary : theme.colors.borderLight)};
    border-radius: 10px;
    background: ${({ theme }) => theme.colors.white};

    .title {
        display: flex;
        align-items: center;
        gap: 0.4rem;
        font-size: 0.85rem;
        font-weight: 700;
        color: ${({ theme }) => theme.colors.textDark};
        min-width: 0;
    }

    .title span {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .meta {
        font-size: 0.72rem;
        color: ${({ theme }) => theme.colors.textMuted};
    }

    .actions {
        display: flex;
        gap: 0.3rem;
        flex-wrap: wrap;
    }
`;

const NewForm = styled.form`
    display: grid;
    grid-template-columns: 1fr 180px auto;
    gap: 0.5rem;
    align-items: end;
    padding: 0.75rem;
    margin-bottom: 1rem;
    border: 1px dashed ${({ theme }) => theme.colors.border};
    border-radius: 10px;

    @media (max-width: 640px) {
        grid-template-columns: 1fr;
    }
`;

const PRESETS = [
    { id: 'classic', label: 'Clássico' },
    { id: 'modern', label: 'Moderno' },
    { id: 'elegant', label: 'Elegante' },
];

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function DesignsModal({ open, onOpenChange }: Props) {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { ctx } = useCertificateRenderContext();
    const [newName, setNewName] = useState('');
    const [newPreset, setNewPreset] = useState('classic');

    const { data: designs, isLoading } = useQuery({ queryKey: ['certificate-designs'], queryFn: () => certificateDesignsApi.list(), enabled: open });

    const refresh = () => {
        queryClient.invalidateQueries({ queryKey: ['certificate-designs'] });
        queryClient.invalidateQueries({ queryKey: ['certificate-template'] });
    };
    const onError = async (error: unknown) => toast.error(await certificateErrorMessage(error, 'Não foi possível concluir.'));

    const createMutation = useMutation({
        mutationFn: (input: { name: string; presetId?: string; duplicateFromId?: string }) => certificateDesignsApi.create(input),
        onSuccess: (created) => {
            refresh();
            onOpenChange(false);
            navigate(`/certificates/designs/${created.id}`);
        },
        onError,
    });

    const defaultMutation = useMutation({
        mutationFn: (id: string) => certificateDesignsApi.setDefault(id),
        onSuccess: () => {
            toast.success('Modelo padrão alterado. Use "Regerar PDFs" para atualizar certificados já emitidos.');
            refresh();
        },
        onError,
    });

    const removeMutation = useMutation({
        mutationFn: (id: string) => certificateDesignsApi.remove(id),
        onSuccess: () => {
            toast.success('Modelo excluído.');
            refresh();
        },
        onError,
    });

    const confirmRemove = (design: CertificateDesign) => {
        const usage = design.coursesCount ? `\n\n${design.coursesCount} turma(s) usam este modelo e passarão a usar o padrão.` : '';
        const fallback = design.isDefault ? '\n\nEle é o padrão: sem outro padrão, os certificados voltam ao layout Clássico.' : '';
        if (window.confirm(`Excluir o modelo "${design.name}"?${usage}${fallback}`)) removeMutation.mutate(design.id);
    };

    return (
        <Modal open={open} onOpenChange={onOpenChange} title="Modelos de certificado" width="880px">
            <NewForm
                onSubmit={(e) => {
                    e.preventDefault();
                    if (newName.trim()) createMutation.mutate({ name: newName.trim(), presetId: newPreset });
                }}
            >
                <Field>
                    <Label htmlFor="newDesignName">Novo modelo</Label>
                    <Input id="newDesignName" placeholder="ex: Brigada — Formação" maxLength={80} value={newName} onChange={(e) => setNewName(e.target.value)} />
                </Field>
                <Field>
                    <Label htmlFor="newDesignPreset">Começar do</Label>
                    <Select id="newDesignPreset" value={newPreset} onChange={(e) => setNewPreset(e.target.value)}>
                        {PRESETS.map((preset) => (
                            <option key={preset.id} value={preset.id}>{preset.label}</option>
                        ))}
                    </Select>
                </Field>
                <Button type="submit" disabled={!newName.trim() || createMutation.isPending}>
                    <Plus size={14} /> Criar e editar
                </Button>
            </NewForm>

            {isLoading ? (
                <p>Carregando...</p>
            ) : !designs?.length ? (
                <HelpText>
                    Nenhum modelo salvo ainda: os certificados usam o layout Clássico. Crie um modelo acima — o primeiro vira o padrão da academia.
                </HelpText>
            ) : (
                <>
                    {!designs.some((design) => design.isDefault) && (
                        <HelpText style={{ display: 'block', marginBottom: '0.75rem' }}>
                            Nenhum modelo é o padrão: as turmas sem modelo escolhido usam o layout Clássico.
                        </HelpText>
                    )}
                    <Grid>
                        {designs.map((design) => (
                            <Card key={design.id} $default={design.isDefault}>
                                <MiniLayout layout={design.layout} ctx={ctx} width={210} />
                                <div className="title">
                                    <span title={design.name}>{design.name}</span>
                                    {design.isDefault && <Badge $tone="info">Padrão</Badge>}
                                </div>
                                <div className="meta">
                                    {design.coursesCount ? `Escolhido em ${design.coursesCount} turma(s)` : design.isDefault ? 'Usado pelas turmas sem modelo escolhido' : 'Nenhuma turma escolheu'}
                                </div>
                                <div className="actions">
                                    <Button type="button" onClick={() => { onOpenChange(false); navigate(`/certificates/designs/${design.id}`); }}>
                                        <Pencil size={13} /> Editar
                                    </Button>
                                    <Button
                                        type="button"
                                        $variant="secondary"
                                        title="Duplicar"
                                        aria-label={`Duplicar ${design.name}`}
                                        disabled={createMutation.isPending}
                                        onClick={() => createMutation.mutate({ name: `${design.name} (cópia)`.slice(0, 80), duplicateFromId: design.id })}
                                    >
                                        <Copy size={13} />
                                    </Button>
                                    {!design.isDefault && (
                                        <Button type="button" $variant="secondary" title="Tornar padrão" aria-label={`Tornar ${design.name} o padrão`} onClick={() => defaultMutation.mutate(design.id)} disabled={defaultMutation.isPending}>
                                            <Star size={13} />
                                        </Button>
                                    )}
                                    <Button type="button" $variant="danger" title="Excluir" aria-label={`Excluir ${design.name}`} onClick={() => confirmRemove(design)} disabled={removeMutation.isPending}>
                                        <Trash2 size={13} />
                                    </Button>
                                </div>
                            </Card>
                        ))}
                    </Grid>
                </>
            )}
        </Modal>
    );
}
