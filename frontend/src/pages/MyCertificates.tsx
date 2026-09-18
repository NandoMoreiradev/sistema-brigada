// frontend/src/pages/MyCertificates.tsx
//
// Fase 3 de posse de dado (docs/decisoes.md): "meus certificados" — o crachá
// digital do próprio aluno, via /me/certificates. Diferente de
// Certificates.tsx (lista completa, agora restrita a `certificates:manage`),
// esta tela não tem regeração de PDF nem personalização — só consulta e
// download do próprio certificado.

import { Award, Download } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { PageLayout } from '@/components/layout/PageLayout';
import { Button } from '@/components/ui/Button';
import { Table, TableWrapper, Thead, Tr, Th, Td, EmptyState, Badge } from '@/components/ui/Table';
import { meApi } from '@/services/me';
import type { CertificateStatus } from '@/services/certificates';

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

export default function MyCertificates() {
    const { data, isLoading } = useQuery({ queryKey: ['me', 'certificates'], queryFn: () => meApi.getMyCertificates() });
    const certificates = data ?? [];

    return (
        <PageLayout title="Meus Certificados" subtitle="Seus certificados e crachás digitais" icon={<Award size={16} />}>
            <TableWrapper>
                <Table>
                    <Thead>
                        <tr>
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
                                        '—'
                                    )}
                                </Td>
                            </Tr>
                        ))}
                    </tbody>
                </Table>
                {!isLoading && certificates.length === 0 && (
                    <EmptyState>Nenhum certificado emitido ainda — ele é gerado automaticamente quando você atinge a presença mínima da turma.</EmptyState>
                )}
            </TableWrapper>
        </PageLayout>
    );
}
