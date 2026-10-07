// frontend/src/pages/public/VerifyCertificatePage.tsx
//
// Rotas públicas /validar e /validar/:code — não requerem login (ver
// PUBLIC_ROUTE_PREFIXES em utils/publicRouting.ts). É o destino do QR impresso
// no PDF do certificado e de quem digita o código lido no papel. Diferente do
// crachá (/badge/:token), que lista tudo de uma pessoa, aqui se confere UM
// certificado específico.

import { useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import styled from 'styled-components';
import { useQuery } from '@tanstack/react-query';
import { ShieldCheck, ShieldAlert, ShieldX, Clock, Search } from 'lucide-react';
import { format } from 'date-fns';
import { isAxiosError } from 'axios';
import { certificatesApi, formatCertificateCode, type CertificateStatus } from '@/services/certificates';

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
    max-width: 460px;
    background: ${({ theme }) => theme.colors.white};
    border-radius: ${({ theme }) => theme.radii.lg};
    box-shadow: ${({ theme }) => theme.shadows.e2};
    padding: 2rem;
    text-align: center;

    h1 {
        font-size: 1.25rem;
        margin: 0 0 0.25rem;
        color: ${({ theme }) => theme.colors.textDark};
    }
`;

type Tone = 'success' | 'warning' | 'danger' | 'neutral';

const IconWrap = styled.div<{ $tone: Tone }>`
    width: 56px;
    height: 56px;
    margin: 0 auto 1rem;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    background: ${({ $tone, theme }) =>
        ({ success: theme.colors.success, warning: '#d4a017', danger: theme.colors.danger, neutral: theme.colors.textMuted })[$tone]};
`;

const Subtitle = styled.p`
    color: ${({ theme }) => theme.colors.textMuted};
    margin: 0 0 1.5rem;
    font-size: 0.875rem;
`;

const Details = styled.dl`
    margin: 0 0 1.5rem;
    text-align: left;
    border: 1px solid ${({ theme }) => theme.colors.borderLight};
    border-radius: ${({ theme }) => theme.radii.sm};

    div {
        display: flex;
        justify-content: space-between;
        gap: 1rem;
        padding: 0.6rem 0.85rem;
    }

    div + div {
        border-top: 1px solid ${({ theme }) => theme.colors.borderLight};
    }

    dt {
        font-size: 0.75rem;
        color: ${({ theme }) => theme.colors.textMuted};
        white-space: nowrap;
    }

    dd {
        margin: 0;
        font-size: 0.8125rem;
        font-weight: 600;
        color: ${({ theme }) => theme.colors.textDark};
        text-align: right;
    }
`;

const SearchForm = styled.form`
    display: flex;
    gap: 0.5rem;

    input {
        flex: 1;
        min-width: 0;
        padding: 0.6rem 0.75rem;
        border: 1px solid ${({ theme }) => theme.colors.border};
        border-radius: ${({ theme }) => theme.radii.sm};
        font-family: monospace;
        font-size: 0.9375rem;
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }

    button {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        padding: 0 1rem;
        border: none;
        border-radius: ${({ theme }) => theme.radii.sm};
        background: ${({ theme }) => theme.colors.primary};
        color: white;
        font-weight: 600;
        cursor: pointer;
    }
`;

const SearchLabel = styled.p`
    margin: 0 0 0.5rem;
    font-size: 0.75rem;
    color: ${({ theme }) => theme.colors.textMuted};
    text-align: left;
`;

const STATUS_VIEW: Record<CertificateStatus, { tone: Tone; icon: typeof ShieldCheck; title: string; text: string }> = {
    VALID: { tone: 'success', icon: ShieldCheck, title: 'Certificado válido', text: 'Este certificado é autêntico e está dentro da validade.' },
    EXPIRED: { tone: 'warning', icon: Clock, title: 'Certificado vencido', text: 'Este certificado é autêntico, mas a validade já terminou.' },
    REVOKED: { tone: 'danger', icon: ShieldX, title: 'Certificado revogado', text: 'Este certificado foi revogado pela instituição e não tem mais validade.' },
};

const formatDate = (value: string) => format(new Date(value), 'dd/MM/yyyy');

export default function VerifyCertificatePage() {
    const { code } = useParams<{ code?: string }>();
    const navigate = useNavigate();
    const [input, setInput] = useState(code ? formatCertificateCode(code) : '');

    const { data, error, isLoading } = useQuery({
        queryKey: ['public-certificate', code],
        queryFn: () => certificatesApi.verify(code!),
        enabled: !!code,
        retry: false,
    });

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        const typed = input.replace(/[\s-]/g, '').toUpperCase();
        if (typed) navigate(`/validar/${typed}`);
    };

    const searchForm = (
        <>
            <SearchLabel>{code ? 'Validar outro código' : 'Digite o código de verificação impresso no certificado'}</SearchLabel>
            <SearchForm onSubmit={handleSubmit}>
                <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="XXXX-XXXX-XXXX"
                    aria-label="Código de verificação"
                    autoComplete="off"
                    spellCheck={false}
                />
                <button type="submit"><Search size={16} /> Validar</button>
            </SearchForm>
        </>
    );

    if (!code) {
        return (
            <Wrapper>
                <Card>
                    <IconWrap $tone="neutral"><ShieldCheck size={28} /></IconWrap>
                    <h1>Validação de certificado</h1>
                    <Subtitle>Confira a autenticidade de um certificado emitido.</Subtitle>
                    {searchForm}
                </Card>
            </Wrapper>
        );
    }

    if (isLoading) {
        return (
            <Wrapper>
                <Card>Validando certificado...</Card>
            </Wrapper>
        );
    }

    if (error || !data) {
        const message = isAxiosError(error) && error.response?.status === 429
            ? 'Muitas tentativas seguidas. Aguarde um minuto e tente de novo.'
            : 'Nenhum certificado foi encontrado com este código. Confira se foi digitado exatamente como está impresso.';
        return (
            <Wrapper>
                <Card>
                    <IconWrap $tone="danger"><ShieldAlert size={28} /></IconWrap>
                    <h1>Certificado não encontrado</h1>
                    <Subtitle>{message}</Subtitle>
                    {searchForm}
                </Card>
            </Wrapper>
        );
    }

    const view = STATUS_VIEW[data.status];
    const Icon = view.icon;

    return (
        <Wrapper>
            <Card>
                <IconWrap $tone={view.tone}><Icon size={28} /></IconWrap>
                <h1>{view.title}</h1>
                <Subtitle>{view.text}</Subtitle>

                <Details>
                    <div><dt>Aluno(a)</dt><dd>{data.studentName}</dd></div>
                    <div><dt>Curso</dt><dd>{data.courseName}</dd></div>
                    <div><dt>Instituição</dt><dd>{data.organizationName}</dd></div>
                    <div><dt>Emitido em</dt><dd>{formatDate(data.issuedAt)}</dd></div>
                    <div><dt>Validade</dt><dd>{data.expiresAt ? `até ${formatDate(data.expiresAt)}` : 'Sem vencimento'}</dd></div>
                    {data.revokedAt && <div><dt>Revogado em</dt><dd>{formatDate(data.revokedAt)}</dd></div>}
                    <div><dt>Código</dt><dd style={{ fontFamily: 'monospace' }}>{formatCertificateCode(data.code)}</dd></div>
                </Details>

                {searchForm}
            </Card>
        </Wrapper>
    );
}
