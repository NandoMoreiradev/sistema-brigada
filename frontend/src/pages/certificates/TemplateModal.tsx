// frontend/src/pages/certificates/TemplateModal.tsx
//
// "Identidade" da tela de Certificados: logo e assinatura da academia, usadas por
// todos os modelos de certificado (o selo e a imagem "logo", a assinatura "da
// academia"). Layout, cores e textos ficam em cada modelo (DesignsModal / editor).

import { useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, X } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Field, Label, Input, Select, HelpText, FormActions } from '@/components/ui/FormField';
import { ImageUploadButton } from '@/components/media/ImageUploadButton';
import { certificateTemplateApi, type CertificateTemplate } from '@/services/certificates';
import { coursesApi } from '@/services/courses';
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
}

const brandPayload = (form: FormState) => ({
    logoUrl: form.logoUrl.trim() || null,
    signatureName: form.signatureName.trim() || null,
    signatureImageUrl: form.signatureImageUrl.trim() || null,
});

const fromTemplate = (template: CertificateTemplate): FormState => ({
    logoUrl: template.logoUrl ?? '',
    signatureName: template.signatureName ?? '',
    signatureImageUrl: template.signatureImageUrl ?? '',
});

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function TemplateModal({ open, onOpenChange }: Props) {
    const queryClient = useQueryClient();
    const [form, setForm] = useState<FormState | null>(null);
    const [previewCourseId, setPreviewCourseId] = useState('');
    const filledRef = useRef(false);
    const preview = usePdfPreview();

    const { data: template, isSuccess } = useQuery({
        queryKey: ['certificate-template'],
        queryFn: () => certificateTemplateApi.get(),
        enabled: open,
    });
    const { data: courses } = useQuery({ queryKey: ['courses'], queryFn: () => coursesApi.list(), enabled: open });

    // Preenche quando o salvo chega — uma vez por abertura, para um refetch em segundo
    // plano não desfazer o que está sendo editado.
    useEffect(() => {
        if (!open) {
            filledRef.current = false;
            setForm(null);
            return;
        }
        if (isSuccess && template && !filledRef.current) {
            setForm(fromTemplate(template));
            filledRef.current = true;
        }
    }, [open, isSuccess, template]);

    const update = (patch: Partial<FormState>) => setForm((current) => (current ? { ...current, ...patch } : current));

    const saveMutation = useMutation({
        mutationFn: (state: FormState) => certificateTemplateApi.upsert(brandPayload(state)),
        onSuccess: (saved) => {
            toast.success('Identidade salva. Use "Regerar PDFs" para atualizar certificados já emitidos.');
            queryClient.setQueryData(['certificate-template'], saved);
            onOpenChange(false);
        },
        onError: async (error) => toast.error(await certificateErrorMessage(error, 'Não foi possível salvar.')),
    });

    return (
        <>
            <Modal open={open} onOpenChange={onOpenChange} title="Identidade da academia nos certificados" width="600px">
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
                            <HelpText>Valem para todos os modelos de certificado. Layout, cores e textos são editados em cada modelo.</HelpText>
                            <Field>
                                <Label htmlFor="logoUrl">Logo (vai no selo e nas imagens "logo da academia")</Label>
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
                            <h3>Pré-visualização</h3>
                            <PreviewRow>
                                <Select aria-label="Turma usada na pré-visualização" value={previewCourseId} onChange={(e) => setPreviewCourseId(e.target.value)}>
                                    <option value="">Turma de exemplo (modelo padrão)</option>
                                    {(courses?.data ?? []).map((course) => (
                                        <option key={course.id} value={course.id}>{course.event.title}</option>
                                    ))}
                                </Select>
                                <Button
                                    type="button"
                                    $variant="secondary"
                                    onClick={() => preview.generate({ ...brandPayload(form), courseId: previewCourseId || undefined })}
                                    disabled={preview.isGenerating}
                                >
                                    <Eye size={14} /> {preview.isGenerating ? 'Gerando...' : 'Pré-visualizar PDF'}
                                </Button>
                            </PreviewRow>
                            <HelpText>Mostra a identidade ainda não salva, com um aluno de exemplo, no modelo que a turma usa.</HelpText>
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
