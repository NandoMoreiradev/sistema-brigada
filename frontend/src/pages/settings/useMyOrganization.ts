// frontend/src/pages/settings/useMyOrganization.ts
//
// Consulta e edição da PRÓPRIA academia (GET/PATCH /organizations/me), compartilhadas pelas abas
// Geral, E-mail e Cadastro público. Cada aba envia só os campos dela (o backend faz atualização
// parcial), então salvar uma aba nunca mexe nas outras.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { organizationsApi } from '@/services/organizations';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/utils/toast';

type UpdateInput = Parameters<typeof organizationsApi.updateMine>[0];

export function useMyOrganization() {
    const { setOrganization } = useAuth();
    const queryClient = useQueryClient();

    const query = useQuery({ queryKey: ['organizations', 'me'], queryFn: () => organizationsApi.getMine() });

    const sync = (updated: Awaited<ReturnType<typeof organizationsApi.updateMine>>) => {
        queryClient.invalidateQueries({ queryKey: ['organizations', 'me'] });
        // Mantém nome/logo do topbar em dia sem esperar um F5.
        setOrganization((prev) => (prev ? { ...prev, ...updated } : prev));
    };

    const save = useMutation({
        mutationFn: (input: UpdateInput) => organizationsApi.updateMine(input),
        onSuccess: (updated) => { toast.success('Configurações da academia atualizadas.'); sync(updated); },
        onError: (error: any) => toast.error(error?.response?.data?.message || 'Não foi possível salvar.'),
    });

    const regenerateToken = useMutation({
        mutationFn: () => organizationsApi.regeneratePublicRegistrationToken(),
        onSuccess: (updated) => { toast.success('Novo link gerado — o link anterior parou de funcionar.'); sync(updated); },
        onError: (error: any) => toast.error(error?.response?.data?.message || 'Não foi possível gerar um novo link.'),
    });

    return { ...query, save, regenerateToken };
}
