// frontend/src/pages/MyCertificates.tsx
//
// Fase 3 de posse de dado (docs/decisoes.md): "meus certificados" — o crachá
// digital do próprio aluno, via /me/certificates. Diferente de
// Certificates.tsx (lista completa, agora restrita a `certificates:manage`),
// esta tela não tem regeração de PDF nem personalização — só consulta e
// download do próprio certificado.

import { Award, Download, Link2, ExternalLink } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { PageLayout } from '@/components/layout/PageLayout';
import { Button } from '@/components/ui/Button';
import { Table, TableWrapper, Thead, Tr, Th, Td, EmptyState, Badge } from '@/components/ui/Table';
import { meApi } from '@/services/me';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/utils/toast';
import { Muted, Toolbar, ToolbarGroup } from '@/pages/course-detail/styles';
import { formatCertificateCode, type CertificateStatus } from '@/services/certificates';

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
    const { user } = useAuth();
    // Página pública (sem login) que lista os certificados válidos: é o que o aluno mostra a
    // quem precisa conferir a formação dele. Antes existia, mas nenhuma tela dava o link.
    const badgeUrl = user?.publicBadgeToken ? `${window.location.origin}/badge/${user.publicBadgeToken}` : null;

    const copyBadgeUrl = async () => {
        if (!badgeUrl) return;
        try {
            await navigator.clipboard.writeText(badgeUrl);
            toast.success('Link do crachá copiado.');
        } catch {
            toast.error('Não foi possível copiar. Use “Abrir crachá” e copie o endereço da página.');
        }
    };

    return (
        <PageLayout title="Meus Certificados" subtitle="Seus certificados e crachás digitais" icon={<Award size={16} />}>
            {badgeUrl && certificates.some((c) => c.status === 'VALID') && (
                <Toolbar>
                    <ToolbarGroup>
                        <Muted style={{ fontSize: '0.8125rem' }}>
                            Crachá digital: uma página pública com seus certificados válidos, para mostrar a quem precisar conferir.
                        </Muted>
                    </ToolbarGroup>
                    <ToolbarGroup>
                        <Button type="button" $variant="secondary" onClick={copyBadgeUrl}>
                            <Link2 size={14} /> Copiar link
                        </Button>
                        <Button as="a" href={badgeUrl} target="_blank" rel="noreferrer" $variant="ghost">
                            <ExternalLink size={14} /> Abrir crachá
                        </Button>
                    </ToolbarGroup>
                </Toolbar>
            )}
            <TableWrapper>
                <Table>
                    <Thead>
                        <tr>
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
                                <Td>{certificate.enrollment.course.event.title}</Td>
                                <Td style={{ whiteSpace: 'nowrap' }}>
                                    <a href={`/validar/${certificate.code}`} target="_blank" rel="noreferrer" title="Abrir a validação pública deste certificado" style={{ fontFamily: 'monospace' }}>
                                        {formatCertificateCode(certificate.code)}
                                    </a>
                                </Td>
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
                    <EmptyState>Nenhum certificado emitido ainda. Ele sai automaticamente depois da última aula da turma, se você tiver cumprido a presença mínima (e as vídeo-aulas, quando a turma exigir). Acompanhe pela página da turma.</EmptyState>
                )}
            </TableWrapper>
        </PageLayout>
    );
}
