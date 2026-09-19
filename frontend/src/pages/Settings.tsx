// frontend/src/pages/Settings.tsx
//
// "Minha Conta" — hoje só a integração pessoal com o Google Calendar (usada
// pra gerar o link do Google Meet automático ao criar uma reunião, ver
// events.service.ts no backend). Sem essa tela não havia como nenhum usuário
// de fato conectar a conta Google: o fluxo OAuth no backend já existia
// (user-integrations.controller.ts) mas não tinha botão em lugar nenhum.

import { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Settings as SettingsIcon, Calendar, Check, Unlink } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import styled from 'styled-components';
import { PageLayout } from '@/components/layout/PageLayout';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Table';
import { integrationsApi } from '@/services/integrations';
import { toast } from '@/utils/toast';

const Card = styled.div`
    background: ${({ theme }) => theme.colors.white};
    border-radius: ${({ theme }) => theme.radii.md};
    border: 1px solid ${({ theme }) => theme.colors.borderLight};
    padding: 1.25rem;
    max-width: 480px;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
`;

const CardHeader = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
`;

const CardTitle = styled.div`
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-weight: 600;
    color: ${({ theme }) => theme.colors.textDark};
`;

const CardDescription = styled.p`
    margin: 0;
    font-size: 0.8125rem;
    color: ${({ theme }) => theme.colors.textMuted};
`;

export default function Settings() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const { data: googleStatus, isLoading } = useQuery({
        queryKey: ['integrations', 'google', 'status'],
        queryFn: () => integrationsApi.getGoogleStatus(),
    });

    useEffect(() => {
        const success = searchParams.get('success');
        const error = searchParams.get('error');

        if (success === 'google_auth_linked') {
            toast.success('Google Calendar conectado com sucesso.');
            queryClient.invalidateQueries({ queryKey: ['integrations', 'google', 'status'] });
        } else if (error === 'google_auth_failed') {
            toast.error('Autorização do Google cancelada ou negada.');
        } else if (error === 'google_sync_error') {
            toast.error('Não foi possível concluir a conexão com o Google. Tente novamente.');
        }

        if (success || error) {
            navigate('/settings', { replace: true });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const connectMutation = useMutation({
        mutationFn: () => integrationsApi.getGoogleAuthUrl(),
        onSuccess: (data) => {
            window.location.href = data.url;
        },
        onError: () => toast.error('Não foi possível iniciar a conexão com o Google.'),
    });

    const disconnectMutation = useMutation({
        mutationFn: () => integrationsApi.disconnectGoogle(),
        onSuccess: () => {
            toast.success('Google Calendar desconectado.');
            queryClient.invalidateQueries({ queryKey: ['integrations', 'google', 'status'] });
        },
        onError: () => toast.error('Não foi possível desconectar.'),
    });

    return (
        <PageLayout title="Minha Conta" subtitle="Integrações e preferências pessoais" icon={<SettingsIcon size={16} />}>
            <Card>
                <CardHeader>
                    <CardTitle><Calendar size={18} /> Google Calendar</CardTitle>
                    {!isLoading && (
                        <Badge $tone={googleStatus?.connected ? 'success' : 'neutral'}>
                            {googleStatus?.connected ? 'Conectado' : 'Não conectado'}
                        </Badge>
                    )}
                </CardHeader>
                <CardDescription>
                    Conecte sua conta Google para que reuniões criadas por você ganhem automaticamente um link do
                    Google Meet.
                </CardDescription>
                {googleStatus?.connected ? (
                    <Button $variant="secondary" onClick={() => disconnectMutation.mutate()} disabled={disconnectMutation.isPending}>
                        <Unlink size={16} /> {disconnectMutation.isPending ? 'Desconectando...' : 'Desconectar'}
                    </Button>
                ) : (
                    <Button onClick={() => connectMutation.mutate()} disabled={connectMutation.isPending}>
                        <Check size={16} /> {connectMutation.isPending ? 'Redirecionando...' : 'Conectar Google Calendar'}
                    </Button>
                )}
            </Card>
        </PageLayout>
    );
}
