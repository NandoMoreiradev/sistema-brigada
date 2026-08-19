// frontend/src/pages/public/BadgePage.tsx
//
// Rota pública /badge/:token — não requer login (ver PUBLIC_ROUTE_PREFIXES em
// utils/publicRouting.ts). Resolve por User.publicBadgeToken no backend e
// lista os Certificate válidos daquele usuário (ver schema.prisma, seção
// CERTIFICADO / CRACHÁ). Endpoint real ainda não existe — esta página só
// monta a casca de carregamento/erro/sucesso.

import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import styled from 'styled-components';
import { ShieldCheck, ShieldAlert } from 'lucide-react';
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
                <p>{data.organizationName}</p>
                <ul style={{ textAlign: 'left', marginTop: '1rem' }}>
                    {data.certificates.map((cert) => (
                        <li key={cert.id}>
                            {cert.courseName} — {cert.status}
                        </li>
                    ))}
                </ul>
            </Card>
        </Wrapper>
    );
}
