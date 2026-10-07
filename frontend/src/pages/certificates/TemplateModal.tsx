// frontend/src/pages/certificates/TemplateModal.tsx
//
// "Personalizar" da tela de Certificados: logo, assinatura, cores do tema do
// layout e pré-visualização em PDF. A pré-visualização é gerada pelo backend com
// os valores ainda não salvos — é o mesmo gerador dos certificados de verdade.
// O editor visual dos elementos (posição, textos) é a Fase 2.

import { useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, RotateCcw, X } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Field, Label, Input, Select, HelpText, CheckboxField, FormActions } from '@/components/ui/FormField';
import { ImageUploadButton } from '@/components/media/ImageUploadButton';
import { certificateTemplateApi, type CertificateTemplate } from '@/services/certificates';
import { coursesApi } from '@/services/courses';
import { THEME_COLORS, type CertificateLayout, type ThemeColorKey } from './layout/types';
import { toast } from '@/utils/toast';
import { certificateErrorMessage, usePdfPreview } from './PdfPreview';

const Section = styled.section`
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 1rem 0;
    border-top: 1px solid ${({ theme }) => theme.colors.borderLight};

    &:first-of-type {
        border-top: none;
        padding-top: 0;
    }

    h3 {
        margin: 0;
        font-size: 0.875rem;
        color: ${({ theme }) => theme.colors.textDark};
    }
`;

const ColorGrid = styled.div`
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.6rem;

    @media (max-width: 560px) {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    label {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.8125rem;
        color: ${({ theme }) => theme.colors.textMedium};
        cursor: pointer;
    }

    input[type='color'] {
        width: 2.25rem;
        height: 2.25rem;
        padding: 0.15rem;
        border: 1px solid ${({ theme }) => theme.colors.border};
        border-radius: ${({ theme }) => theme.radii.sm};
        background: ${({ theme }) => theme.colors.white};
        cursor: pointer;
        flex-shrink: 0;
    }
`;

const PreviewRow = styled.div`
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;

    select {
        flex: 1;
        min-width: 12rem;
    }
`;

const imagePreviewStyle = { maxHeight: 60, border: '1px solid #dee2e6', borderRadius: 6, padding: 4 };

interface FormState {
    logoUrl: string;
    signatureName: string;
    signatureImageUrl: string;
    layout: CertificateLayout;
}

const brandPayload = (form: FormState) => ({
    logoUrl: form.logoUrl.trim() || null,
    signatureName: form.signatureName.trim() || null,
    signatureImageUrl: form.signatureImageUrl.trim() || null,
});

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function TemplateModal({ open, onOpenChange }: Props) {
    const queryClient = useQueryClient();
    const [form, setForm] = useState<FormState | null>(null);
    const [layoutDirty, setLayoutDirty] = useState(false);
    const [previewCourseId, setPreviewCourseId] = useState('');
    const filledRef = useRef(false);

    const { data: template, isSuccess } = useQuery({
        queryKey: ['certificate-template'],
        queryFn: () => certificateTemplateApi.get(),
        enabled: open,
    });
    const { data: courses } = useQuery({ queryKey: ['courses'], queryFn: () => coursesApi.list(), enabled: open });

    // Preenche quando o modelo salvo chega — uma vez por abertura, para um refetch em
    // segundo plano não desfazer o que está sendo editado.
    useEffect(() => {
        if (!open) {
            filledRef.current = false;
            setForm(null);
            return;
        }
        if (isSuccess && template && !filledRef.current) {
            setForm(fromTemplate(template));
            setLayoutDirty(false);
            filledRef.current = true;
        }
    }, [open, isSuccess, template]);

    const update = (patch: Partial<FormState>) => setForm((current) => (current ? { ...current, ...patch } : current));
    const updateLayout = (change: (layout: CertificateLayout) => CertificateLayout) => {
        setForm((current) => (current ? { ...current, layout: change(current.layout) } : current));
        setLayoutDirty(true);
    };

    const saveMutation = useMutation({
        mutationFn: (state: FormState) =>
            certificateTemplateApi.upsert({ ...brandPayload(state), ...(layoutDirty ? { layoutConfig: state.layout } : {}) }),
        onSuccess: () => {
            toast.success('Personalização salva. Use "Regerar PDF" para atualizar certificados já emitidos.');
            queryClient.invalidateQueries({ queryKey: ['certificate-template'] });
            onOpenChange(false);
        },
        onError: async (error) => toast.error(await certificateErrorMessage(error, 'Não foi possível salvar.')),
    });

    const restoreMutation = useMutation({
        mutationFn: () => certificateTemplateApi.upsert({ layoutConfig: null }),
        onSuccess: (saved) => {
            toast.success('Layout Clássico restaurado.');
            queryClient.setQueryData(['certificate-template'], saved);
            update({ layout: saved.layout });
            setLayoutDirty(false);
        },
        onError: async (error) => toast.error(await certificateErrorMessage(error, 'Não foi possível restaurar.')),
    });

    const preview = usePdfPreview();

    return (
        <>
            <Modal open={open} onOpenChange={onOpenChange} title="Personalização do certificado" width="640px">
                {!form ? (
                    <p>Carregando...</p>
                ) : (
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            saveMutation.mutate(form);
                        }}
                    >
                        <Section>
                            <h3>Identidade da academia</h3>
                            <Field>
                                <Label htmlFor="logoUrl">Logo (vai dentro do selo)</Label>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <Input id="logoUrl" placeholder="https://... (ou envie um arquivo)" value={form.logoUrl} onChange={(e) => update({ logoUrl: e.target.value })} style={{ flex: 1 }} />
                                    <ImageUploadButton context="organization-branding" pdfSafe onUploaded={(url) => update({ logoUrl: url })} disabled={saveMutation.isPending} />
                                </div>
                                {form.logoUrl && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
                                        <img src={form.logoUrl} alt="Pré-visualização do logo" style={imagePreviewStyle} />
                                        <Button type="button" $variant="ghost" onClick={() => update({ logoUrl: '' })}>
                                            <X size={14} /> Remover
                                        </Button>
                                    </div>
                                )}
                                <HelpText>PNG ou JPG. Arquivos WEBP e GIF enviados aqui são convertidos para PNG; SVG não sai no PDF.</HelpText>
                            </Field>
                            <Field>
                                <Label htmlFor="signatureName">Nome de quem assina (diretor/instrutor)</Label>
                                <Input id="signatureName" value={form.signatureName} onChange={(e) => update({ signatureName: e.target.value })} />
                            </Field>
                            <Field>
                                <Label htmlFor="signatureImageUrl">Imagem da assinatura (opcional)</Label>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <Input
                                        id="signatureImageUrl"
                                        placeholder="https://... (ou envie um arquivo)"
                                        value={form.signatureImageUrl}
                                        onChange={(e) => update({ signatureImageUrl: e.target.value })}
                                        style={{ flex: 1 }}
                                    />
                                    <ImageUploadButton context="organization-branding" pdfSafe onUploaded={(url) => update({ signatureImageUrl: url })} disabled={saveMutation.isPending} />
                                </div>
                                {form.signatureImageUrl && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
                                        <img src={form.signatureImageUrl} alt="Pré-visualização da assinatura" style={imagePreviewStyle} />
                                        <Button type="button" $variant="ghost" onClick={() => update({ signatureImageUrl: '' })}>
                                            <X size={14} /> Remover
                                        </Button>
                                    </div>
                                )}
                            </Field>
                        </Section>

                        <Section>
                            <h3>Cores</h3>
                            <ColorGrid>
                                {THEME_COLORS.map(({ key, label }) => (
                                    <label key={key}>
                                        <input
                                            type="color"
                                            value={form.layout.theme[key]}
                                            onChange={(e) => updateLayout((layout) => ({ ...layout, theme: { ...layout.theme, [key as ThemeColorKey]: e.target.value.toUpperCase() } }))}
                                        />
                                        {label}
                                    </label>
                                ))}
                            </ColorGrid>
                            <CheckboxField>
                                <input
                                    type="checkbox"
                                    checked={form.layout.syllabusPage.enabled}
                                    onChange={(e) => updateLayout((layout) => ({ ...layout, syllabusPage: { ...layout.syllabusPage, enabled: e.target.checked } }))}
                                />
                                Incluir a página de conteúdo programático (quando a turma tiver um)
                            </CheckboxField>
                            <HelpText>
                                Para mover elementos, trocar textos, adicionar imagens ou usar um modelo pronto, use o{' '}
                                <Link to="/certificates/editor" onClick={() => onOpenChange(false)}>editor de layout</Link>.
                            </HelpText>
                            {!template?.isDefaultLayout && (
                                <div>
                                    <Button
                                        type="button"
                                        $variant="ghost"
                                        disabled={restoreMutation.isPending}
                                        onClick={() => window.confirm('Voltar ao layout Clássico? As cores e ajustes de layout salvos serão descartados.') && restoreMutation.mutate()}
                                    >
                                        <RotateCcw size={14} /> Restaurar layout Clássico
                                    </Button>
                                </div>
                            )}
                        </Section>

                        <Section>
                            <h3>Pré-visualização</h3>
                            <PreviewRow>
                                <Select aria-label="Turma usada na pré-visualização" value={previewCourseId} onChange={(e) => setPreviewCourseId(e.target.value)}>
                                    <option value="">Turma de exemplo</option>
                                    {(courses?.data ?? []).map((course) => (
                                        <option key={course.id} value={course.id}>{course.event.title}</option>
                                    ))}
                                </Select>
                                <Button type="button" $variant="secondary" onClick={() => preview.generate({ ...brandPayload(form), layout: form.layout, courseId: previewCourseId || undefined })} disabled={preview.isGenerating}>
                                    <Eye size={14} /> {preview.isGenerating ? 'Gerando...' : 'Pré-visualizar PDF'}
                                </Button>
                            </PreviewRow>
                            <HelpText>Mostra as alterações ainda não salvas, com um aluno de exemplo.</HelpText>
                        </Section>

                        <FormActions>
                            <Button type="button" $variant="secondary" onClick={() => onOpenChange(false)}>Cancelar</Button>
                            <Button type="submit" disabled={saveMutation.isPending}>{saveMutation.isPending ? 'Salvando...' : 'Salvar'}</Button>
                        </FormActions>
                    </form>
                )}
            </Modal>

            {preview.dialog}
        </>
    );
}

function fromTemplate(template: CertificateTemplate): FormState {
    return {
        logoUrl: template.logoUrl ?? '',
        signatureName: template.signatureName ?? '',
        signatureImageUrl: template.signatureImageUrl ?? '',
        layout: template.layout,
    };
}
