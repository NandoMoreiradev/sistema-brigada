// frontend/src/pages/public/BadgePage.tsx
//
// Rota pública /badge/:token — não requer login (ver PUBLIC_ROUTE_PREFIXES em
// utils/publicRouting.ts). Resolve por User.publicBadgeToken no backend
// (backend/src/certificates/public-badge.controller.ts) e lista os
// Certificate do usuário (decisão 20 do docs/decisoes.md: crachá válido em
// toda a rede da academia). QR code aponta para a própria página — permite
// reescanear o crachá impresso/printado.

import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import styled from 'styled-components';
import { ShieldCheck, ShieldAlert } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { format } from 'date-fns';
import { api } from '@/services/api';

const Wrapper = styled.div`
    min-height: 100vh;
    min-height: 100dvh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: ${({ theme }) => theme.colors.pageBackground};
    padding: 1rem;
`;

const Card = styled.div`
    width: 100%;
    max-width: 420px;
    background: ${({ theme }) => theme.colors.white};
    border-radius: ${({ theme }) => theme.radii.lg};
    box-shadow: ${({ theme }) => theme.shadows.e2};
    padding: 2rem;
    text-align: center;
`;

const IconWrap = styled.div<{ $tone: 'ok' | 'error' }>`
    width: 56px;
    height: 56px;
    margin: 0 auto 1rem;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    background: ${({ $tone, theme }) => ($tone === 'ok' ? theme.colors.success : theme.colors.danger)};
`;

const OrgName = styled.p`
    color: ${({ theme }) => theme.colors.textMuted};
    margin: 0.25rem 0 1.25rem;
    font-size: 0.875rem;
`;

const CertList = styled.ul`
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    text-align: left;
`;

const CertItem = styled.li`
    border: 1px solid ${({ theme }) => theme.colors.borderLight};
    border-radius: ${({ theme }) => theme.radii.sm};
    padding: 0.65rem 0.85rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.5rem;
`;

const CertInfo = styled.div`
    display: flex;
    flex-direction: column;
    gap: 0.15rem;

    strong {
        font-size: 0.8125rem;
        color: ${({ theme }) => theme.colors.textDark};
    }

    span {
        font-size: 0.7rem;
        color: ${({ theme }) => theme.colors.textMuted};
    }
`;

const StatusPill = styled.span<{ $tone: 'success' | 'warning' | 'danger' }>`
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    padding: 0.15rem 0.5rem;
    border-radius: ${({ theme }) => theme.radii.pill};
    white-space: nowrap;
    ${({ $tone, theme }) => {
        const map = {
            success: `background:#e6f7ec;color:${theme.colors.success};`,
            warning: `background:#fff8e1;color:#b8860b;`,
            danger: `background:#fdecea;color:${theme.colors.danger};`,
        };
        return map[$tone];
    }}
`;

const QrWrap = styled.div`
    margin-top: 1.5rem;
    padding-top: 1.5rem;
    border-top: 1px solid ${({ theme }) => theme.colors.borderLight};
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;

    span {
        font-size: 0.7rem;
        color: ${({ theme }) => theme.colors.textMuted};
    }
`;

const STATUS_LABEL: Record<string, string> = { VALID: 'Válido', EXPIRED: 'Vencido', REVOKED: 'Revogado' };
const STATUS_TONE: Record<string, 'success' | 'warning' | 'danger'> = {
    VALID: 'success',
    EXPIRED: 'warning',
    REVOKED: 'danger',
};

interface BadgeData {
    userName: string;
    organizationName: string;
    certificates: Array<{ id: string; courseName: string; status: string; expiresAt: string | null }>;
}

export default function BadgePage() {
    const { token } = useParams<{ token: string }>();
    const [data, setData] = useState<BadgeData | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!token) return;

        api.get<BadgeData>(`/public/badge/${token}`)
            .then((response) => setData(response.data))
            .catch((err) => setError(err?.response?.data?.message || 'Crachá não encontrado ou inválido.'))
            .finally(() => setIsLoading(false));
    }, [token]);

    if (isLoading) {
        return (
            <Wrapper>
                <Card>Carregando crachá...</Card>
            </Wrapper>
        );
    }

    if (error || !data) {
        return (
            <Wrapper>
                <Card>
                    <IconWrap $tone="error"><ShieldAlert size={28} /></IconWrap>
                    <h2>Crachá inválido</h2>
                    <p>{error}</p>
                </Card>
            </Wrapper>
        );
    }

    return (
        <Wrapper>
            <Card>
                <IconWrap $tone="ok"><ShieldCheck size={28} /></IconWrap>
                <h2>{data.userName}</h2>
                <OrgName>{data.organizationName}</OrgName>

                <CertList>
                    {data.certificates.map((cert) => (
                        <CertItem key={cert.id}>
                            <CertInfo>
                                <strong>{cert.courseName}</strong>
                                <span>{cert.expiresAt ? `Válido até ${format(new Date(cert.expiresAt), 'dd/MM/yyyy')}` : 'Sem vencimento'}</span>
                            </CertInfo>
                            <StatusPill $tone={STATUS_TONE[cert.status] ?? 'success'}>
                                {STATUS_LABEL[cert.status] ?? cert.status}
                            </StatusPill>
                        </CertItem>
                    ))}
                    {data.certificates.length === 0 && <span>Nenhum certificado emitido ainda.</span>}
                </CertList>

                <QrWrap>
                    <QRCodeSVG value={window.location.href} size={96} />
                    <span>Escaneie para validar este crachá</span>
                </QrWrap>
            </Card>
        </Wrapper>
    );
}
