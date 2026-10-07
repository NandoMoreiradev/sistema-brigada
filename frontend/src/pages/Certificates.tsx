// frontend/src/pages/Certificates.tsx
//
// Certificados emitidos automaticamente por critério de presença/aulas
// (decisão 16 do docs/decisoes.md) — esta tela é consulta, regeração de PDF,
// revogação e personalização visual por academia (decisão 21). A emissão manual
// (`POST /certificates/issue`) existe na API para casos excepcionais, mas
// ainda não tem UI dedicada — o fluxo principal é automático.

import { useState } from 'react';
import { Award, Settings, Download, RefreshCw, ShieldCheck, Copy, Ban, RotateCcw, BellRing } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { isAxiosError } from 'axios';
import { PageLayout } from '@/components/layout/PageLayout';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { ActionMenu, MoreButton, type MenuEntry } from '@/components/ui/ActionMenu';
import { Field, Label, Select, Textarea, HelpText, Form, FormActions } from '@/components/ui/FormField';
import { Table, TableWrapper, Thead, Tr, Th, Td, EmptyState, Badge } from '@/components/ui/Table';
import {
    certificatesApi,
    formatCertificateCode,
    type Certificate,
    type CertificateStatus,
} from '@/services/certificates';
import { TemplateModal } from '@/pages/certificates/TemplateModal';
import { ReminderSettingsModal } from '@/pages/certificates/ReminderSettingsModal';
import { ReminderHistoryModal } from '@/pages/certificates/ReminderHistoryModal';
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


const errorMessage = (error: unknown, fallback: string) => (isAxiosError(error) && error.response?.data?.message) || fallback;

export default function Certificates() {
    const [statusFilter, setStatusFilter] = useState<CertificateStatus | ''>('');
    const [templateModalOpen, setTemplateModalOpen] = useState(false);
    const [revoking, setRevoking] = useState<Certificate | null>(null);
    const [revokeReason, setRevokeReason] = useState('');
    const [reminderSettingsOpen, setReminderSettingsOpen] = useState(false);
    const [reminderHistoryFor, setReminderHistoryFor] = useState<Certificate | null>(null);
    const queryClient = useQueryClient();

    const { data, isLoading } = useQuery({
        queryKey: ['certificates', { status: statusFilter }],
        queryFn: () => certificatesApi.list({ status: statusFilter || undefined }),
    });

    const invalidateCertificates = () => queryClient.invalidateQueries({ queryKey: ['certificates'] });

    const regenerateMutation = useMutation({
        mutationFn: (id: string) => certificatesApi.regeneratePdf(id),
        onSuccess: () => {
            toast.success('PDF regerado com sucesso.');
            invalidateCertificates();
        },
        onError: (error) => toast.error(errorMessage(error, 'Não foi possível gerar o PDF.')),
    });

    const revokeMutation = useMutation({
        mutationFn: ({ id, reason }: { id: string; reason: string }) => certificatesApi.revoke(id, reason),
        onSuccess: () => {
            toast.success('Certificado revogado. A validação pública já mostra a revogação.');
            invalidateCertificates();
            setRevoking(null);
        },
        onError: (error) => toast.error(errorMessage(error, 'Não foi possível revogar.')),
    });

    const reinstateMutation = useMutation({
        mutationFn: (id: string) => certificatesApi.reinstate(id),
        onSuccess: () => {
            toast.success('Revogação desfeita.');
            invalidateCertificates();
        },
        onError: (error) => toast.error(errorMessage(error, 'Não foi possível reativar.')),
    });

    const openRevokeModal = (certificate: Certificate) => {
        setRevokeReason('');
        setRevoking(certificate);
    };

    const copyCode = async (code: string) => {
        try {
            await navigator.clipboard.writeText(formatCertificateCode(code));
            toast.success('Código copiado.');
        } catch {
            toast.error('Não foi possível copiar o código.');
        }
    };

    const menuEntries = (certificate: Certificate): MenuEntry[] => [
        {
            label: 'Abrir validação pública',
            icon: <ShieldCheck size={14} />,
            onSelect: () => window.open(`/validar/${certificate.code}`, '_blank', 'noopener'),
        },
        { label: 'Copiar código', icon: <Copy size={14} />, onSelect: () => copyCode(certificate.code) },
        { label: 'Lembretes de vencimento', icon: <BellRing size={14} />, onSelect: () => setReminderHistoryFor(certificate) },
        {
            label: 'Regerar PDF',
            icon: <RefreshCw size={14} />,
            hint: 'aplica a personalização atual',
            disabled: regenerateMutation.isPending,
            onSelect: () => regenerateMutation.mutate(certificate.id),
        },
        { type: 'separator' },
        certificate.status === 'REVOKED'
            ? {
                  label: 'Desfazer revogação',
                  icon: <RotateCcw size={14} />,
                  disabled: reinstateMutation.isPending,
                  onSelect: () => reinstateMutation.mutate(certificate.id),
              }
            : { label: 'Revogar certificado', icon: <Ban size={14} />, danger: true, onSelect: () => openRevokeModal(certificate) },
    ];

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
                    <Button $variant="secondary" onClick={() => setReminderSettingsOpen(true)} style={{ marginRight: '0.5rem' }}>
                        <BellRing size={16} /> Lembretes
                    </Button>
                    <Button $variant="secondary" onClick={() => setTemplateModalOpen(true)}>
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
                            <Th>Código</Th>
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
                                <Td style={{ fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{formatCertificateCode(certificate.code)}</Td>
                                <Td>{format(new Date(certificate.issuedAt), 'dd/MM/yyyy')}</Td>
                                <Td>{certificate.expiresAt ? format(new Date(certificate.expiresAt), 'dd/MM/yyyy') : 'Sem vencimento'}</Td>
                                <Td>
                                    <Badge
                                        $tone={STATUS_TONE[certificate.status]}
                                        title={certificate.status === 'REVOKED' && certificate.revokedReason ? `Motivo: ${certificate.revokedReason}` : undefined}
                                    >
                                        {STATUS_LABEL[certificate.status]}
                                    </Badge>
                                </Td>
                                <Td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
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
                                    <ActionMenu trigger={<MoreButton />} entries={menuEntries(certificate)} />
                                </Td>
                            </Tr>
                        ))}
                    </tbody>
                </Table>
                {!isLoading && certificates.length === 0 && (
                    <EmptyState>
                        {statusFilter
                            ? 'Nenhum certificado com este status.'
                            : 'Nenhum certificado emitido ainda — eles são gerados automaticamente quando um aluno atinge a presença mínima da turma.'}
                    </EmptyState>
                )}
            </TableWrapper>

            <TemplateModal open={templateModalOpen} onOpenChange={setTemplateModalOpen} />

            <ReminderSettingsModal open={reminderSettingsOpen} onOpenChange={setReminderSettingsOpen} />
            <ReminderHistoryModal certificate={reminderHistoryFor} onClose={() => setReminderHistoryFor(null)} />

            <Modal open={!!revoking} onOpenChange={(open) => !open && setRevoking(null)} title="Revogar certificado">
                {revoking && (
                    <Form
                        onSubmit={(e) => {
                            e.preventDefault();
                            revokeMutation.mutate({ id: revoking.id, reason: revokeReason });
                        }}
                    >
                        <p style={{ margin: 0 }}>
                            Certificado de <strong>{revoking.enrollment.studentProfile.user.name}</strong> na turma{' '}
                            <strong>{revoking.enrollment.course.event.title}</strong>. Quem validar o código{' '}
                            <strong>{formatCertificateCode(revoking.code)}</strong> passará a ver que ele foi revogado.
                        </p>
                        <Field>
                            <Label htmlFor="revokeReason">Motivo</Label>
                            <Textarea
                                id="revokeReason"
                                rows={3}
                                maxLength={500}
                                value={revokeReason}
                                onChange={(e) => setRevokeReason(e.target.value)}
                                placeholder="Ex.: emitido por engano, presença lançada errada..."
                            />
                            <HelpText>Fica registrado internamente; não aparece na validação pública.</HelpText>
                        </Field>
                        <FormActions>
                            <Button type="button" $variant="secondary" onClick={() => setRevoking(null)}>Cancelar</Button>
                            <Button type="submit" $variant="danger" disabled={!revokeReason.trim() || revokeMutation.isPending}>
                                {revokeMutation.isPending ? 'Revogando...' : 'Revogar'}
                            </Button>
                        </FormActions>
                    </Form>
                )}
            </Modal>
        </PageLayout>
    );
}
