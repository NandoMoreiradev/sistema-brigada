// frontend/src/pages/settings/IntegrationsTab.tsx
//
// Aba "Integrações": conexões da conta pessoal com serviços externos (hoje só Google Calendar).

import { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Calendar, Check, Unlink } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Table';
import { integrationsApi } from '@/services/integrations';
import { toast } from '@/utils/toast';
import { SettingsCard, TabStack, StatusRow, CardSkeleton } from './SettingsParts';

export function IntegrationsTab() {
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

    if (isLoading) return <TabStack><CardSkeleton /></TabStack>;

    return (
        <TabStack>
            <SettingsCard
                icon={<Calendar size={18} />}
                tone={googleStatus?.connected ? 'success' : 'neutral'}
                title="Google Calendar"
                description="Reuniões criadas por você ganham automaticamente um link do Google Meet."
                aside={
                    <Badge $tone={googleStatus?.connected ? 'success' : 'neutral'}>
                        {googleStatus?.connected ? 'Conectado' : 'Não conectado'}
                    </Badge>
                }
            >
                <StatusRow>
                    <span style={{ fontSize: '0.8125rem', color: '#6c757d' }}>
                        {googleStatus?.connected ? 'Sua conta Google está vinculada.' : 'Conecte sua conta Google para ativar.'}
                    </span>
                    {googleStatus?.connected ? (
                        <Button $variant="secondary" onClick={() => disconnectMutation.mutate()} disabled={disconnectMutation.isPending}>
                            <Unlink size={16} /> {disconnectMutation.isPending ? 'Desconectando...' : 'Desconectar'}
                        </Button>
                    ) : (
                        <Button onClick={() => connectMutation.mutate()} disabled={connectMutation.isPending}>
                            <Check size={16} /> {connectMutation.isPending ? 'Redirecionando...' : 'Conectar Google Calendar'}
                        </Button>
                    )}
                </StatusRow>
            </SettingsCard>
        </TabStack>
    );
}
