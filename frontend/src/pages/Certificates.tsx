// frontend/src/pages/Certificates.tsx
//
// Certificados emitidos automaticamente por critério de presença/aulas
// (decisão 16 do docs/decisoes.md) — esta tela é só consulta + regeração de
// PDF + personalização visual por academia (decisão 21). A emissão manual
// (`POST /certificates/issue`) existe na API para casos excepcionais, mas
// ainda não tem UI dedicada — o fluxo principal é automático.

import { useState } from 'react';
import { Award, Settings, Download, RefreshCw } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { PageLayout } from '@/components/layout/PageLayout';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Field, Label, Input, Select, Form, FormActions } from '@/components/ui/FormField';
import { Table, TableWrapper, Thead, Tr, Th, Td, EmptyState, Badge } from '@/components/ui/Table';
import { certificatesApi, certificateTemplateApi, type CertificateStatus } from '@/services/certificates';
import { toast } from '@/utils/toast';

const STATUS_LABEL: Record<CertificateStatus, string> = {
    VALID: 'Válido',
    EXPIRED: 'Vencido',
    REVOKED: 'Revogado',
};

const STATUS_TONE: Record<CertificateStatus, 'success' | 'warning' | 'danger'> = {
    VALID: 'success',
    EXPIRED: 'warning',
    REVOKED: 'danger',
};

interface TemplateFormData {
    logoUrl: string;
    signatureName: string;
    signatureImageUrl: string;
}

export default function Certificates() {
    const [statusFilter, setStatusFilter] = useState<CertificateStatus | ''>('');
    const [templateModalOpen, setTemplateModalOpen] = useState(false);
    const queryClient = useQueryClient();

    const { data, isLoading } = useQuery({
        queryKey: ['certificates', { status: statusFilter }],
        queryFn: () => certificatesApi.list({ status: statusFilter || undefined }),
    });

    const { data: template } = useQuery({
        queryKey: ['certificate-template'],
        queryFn: () => certificateTemplateApi.get(),
        enabled: templateModalOpen,
    });

    const { register, handleSubmit, reset } = useForm<TemplateFormData>();

    const openTemplateModal = () => {
        reset({
            logoUrl: template?.logoUrl || '',
            signatureName: template?.signatureName || '',
            signatureImageUrl: template?.signatureImageUrl || '',
        });
        setTemplateModalOpen(true);
    };

    const saveTemplateMutation = useMutation({
        mutationFn: (input: TemplateFormData) =>
            certificateTemplateApi.upsert({
                logoUrl: input.logoUrl || undefined,
                signatureName: input.signatureName || undefined,
                signatureImageUrl: input.signatureImageUrl || undefined,
            }),
        onSuccess: () => {
            toast.success('Personalização do certificado salva.');
            queryClient.invalidateQueries({ queryKey: ['certificate-template'] });
            setTemplateModalOpen(false);
        },
        onError: (error: any) => toast.error(error?.response?.data?.message || 'Não foi possível salvar.'),
    });

    const regenerateMutation = useMutation({
        mutationFn: (id: string) => certificatesApi.regeneratePdf(id),
        onSuccess: () => {
            toast.success('PDF regerado com sucesso.');
            queryClient.invalidateQueries({ queryKey: ['certificates'] });
        },
        onError: (error: any) => toast.error(error?.response?.data?.message || 'Não foi possível gerar o PDF.'),
    });

    const certificates = data?.data ?? [];

    return (
        <PageLayout
            title="Certificados"
            subtitle="Emissão automática por presença e diplomas digitais"
            icon={<Award size={16} />}
            actions={
                <>
                    <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as CertificateStatus | '')} style={{ marginRight: '0.5rem' }}>
                        <option value="">Todos os status</option>
                        <option value="VALID">Válidos</option>
                        <option value="EXPIRED">Vencidos</option>
                        <option value="REVOKED">Revogados</option>
                    </Select>
                    <Button $variant="secondary" onClick={openTemplateModal}>
                        <Settings size={16} /> Personalizar
                    </Button>
                </>
            }
        >
            <TableWrapper>
                <Table>
                    <Thead>
                        <tr>
                            <Th>Aluno</Th>
                            <Th>Turma</Th>
                            <Th>Emitido em</Th>
                            <Th>Validade</Th>
                            <Th>Status</Th>
                            <Th></Th>
                        </tr>
                    </Thead>
                    <tbody>
                        {certificates.map((certificate) => (
                            <Tr key={certificate.id}>
                                <Td>{certificate.enrollment.studentProfile.user.name}</Td>
                                <Td>{certificate.enrollment.course.event.title}</Td>
                                <Td>{format(new Date(certificate.issuedAt), 'dd/MM/yyyy')}</Td>
                                <Td>{certificate.expiresAt ? format(new Date(certificate.expiresAt), 'dd/MM/yyyy') : 'Sem vencimento'}</Td>
                                <Td><Badge $tone={STATUS_TONE[certificate.status]}>{STATUS_LABEL[certificate.status]}</Badge></Td>
                                <Td>
                                    {certificate.pdfUrl ? (
                                        <Button as="a" href={certificate.pdfUrl} target="_blank" rel="noreferrer" $variant="ghost">
                                            <Download size={14} /> PDF
                                        </Button>
                                    ) : (
                                        <Button
                                            $variant="ghost"
                                            onClick={() => regenerateMutation.mutate(certificate.id)}
                                            disabled={regenerateMutation.isPending}
                                        >
                                            <RefreshCw size={14} /> Gerar PDF
                                        </Button>
                                    )}
                                </Td>
                            </Tr>
                        ))}
                    </tbody>
                </Table>
                {!isLoading && certificates.length === 0 && (
                    <EmptyState>Nenhum certificado emitido ainda — eles são gerados automaticamente quando um aluno atinge a presença mínima da turma.</EmptyState>
                )}
            </TableWrapper>

            <Modal open={templateModalOpen} onOpenChange={setTemplateModalOpen} title="Personalização do certificado">
                <Form onSubmit={handleSubmit((data) => saveTemplateMutation.mutate(data))}>
                    <Field>
                        <Label htmlFor="logoUrl">URL do logo da academia</Label>
                        <Input id="logoUrl" placeholder="https://..." {...register('logoUrl')} />
                    </Field>
                    <Field>
                        <Label htmlFor="signatureName">Nome de quem assina (diretor/instrutor)</Label>
                        <Input id="signatureName" {...register('signatureName')} />
                    </Field>
                    <Field>
                        <Label htmlFor="signatureImageUrl">URL da imagem da assinatura (opcional)</Label>
                        <Input id="signatureImageUrl" placeholder="https://..." {...register('signatureImageUrl')} />
                    </Field>
                    <FormActions>
                        <Button type="button" $variant="secondary" onClick={() => setTemplateModalOpen(false)}>Cancelar</Button>
                        <Button type="submit" disabled={saveTemplateMutation.isPending}>
                            {saveTemplateMutation.isPending ? 'Salvando...' : 'Salvar'}
                        </Button>
                    </FormActions>
                </Form>
            </Modal>
        </PageLayout>
    );
}
