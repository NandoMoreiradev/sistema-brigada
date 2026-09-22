// frontend/src/pages/admin/emails/CommunicationsTab.tsx
//
// Lista de comunicados (e-mail avulso pra pessoas da academia) — criar navega direto pro
// construtor visual (CommunicationEditor.tsx), igual o fluxo de "Novo template" faz em
// TemplatesTab.tsx. Editar/Excluir só aparecem em rascunho (DRAFT) — depois de enviado, o
// comunicado vira só histórico (ver decisão no editor: update() bloqueia fora de DRAFT).

import { Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import styled from 'styled-components';
import { Button } from '@/components/ui/Button';
import { Table, TableWrapper, Thead, Tr, Th, Td, EmptyState, Badge } from '@/components/ui/Table';
import { communicationsApi, type CommunicationAudience, type CommunicationStatus } from '@/services/communications';
import { formatAppDate } from '@/utils/datetime';
import { toast } from '@/utils/toast';

const ToolbarRow = styled.div`
    display: flex;
    justify-content: flex-end;
    margin-bottom: 0.75rem;
`;

const AUDIENCE_LABEL: Record<CommunicationAudience, string> = {
    ALL: 'Todas as pessoas',
    STUDENTS: 'Somente alunos',
    STAFF: 'Somente equipe',
    CUSTOM: 'Pessoas específicas',
};

const STATUS_LABEL: Record<CommunicationStatus, string> = {
    DRAFT: 'Rascunho',
    SENDING: 'Enviando...',
    SENT: 'Enviado',
    FAILED: 'Falhou',
};

const STATUS_TONE: Record<CommunicationStatus, 'neutral' | 'success' | 'info' | 'danger'> = {
    DRAFT: 'neutral',
    SENDING: 'info',
    SENT: 'success',
    FAILED: 'danger',
};

export function CommunicationsTab() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const { data, isLoading } = useQuery({
        queryKey: ['communications'],
        queryFn: () => communicationsApi.list(),
        // Enquanto algum comunicado está "Enviando...", o envio roda em background no backend
        // (fire-and-forget) — refetch periódico até todos saírem desse estado, sem precisar de
        // WebSocket só pra isso.
        refetchInterval: (query) => (query.state.data?.data.some((c) => c.status === 'SENDING') ? 3000 : false),
    });

    const createMutation = useMutation({
        mutationFn: () => communicationsApi.create(),
        onSuccess: (communication) => {
            queryClient.invalidateQueries({ queryKey: ['communications'] });
            navigate(`/admin/communications/${communication.id}/edit`);
        },
        onError: (error: any) => toast.error(error?.response?.data?.message || 'Não foi possível criar o comunicado.'),
    });

    const removeMutation = useMutation({
        mutationFn: (id: string) => communicationsApi.remove(id),
        onSuccess: () => {
            toast.success('Comunicado removido.');
            queryClient.invalidateQueries({ queryKey: ['communications'] });
        },
        onError: (error: any) => toast.error(error?.response?.data?.message || 'Não foi possível remover o comunicado.'),
    });

    const communications = data?.data ?? [];

    return (
        <>
            <ToolbarRow>
                <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
                    <Plus size={16} /> Novo comunicado
                </Button>
            </ToolbarRow>

            <TableWrapper>
                <Table>
                    <Thead>
                        <tr>
                            <Th>Assunto</Th>
                            <Th>Público-alvo</Th>
                            <Th>Destinatários</Th>
                            <Th>Abertos</Th>
                            <Th>Status</Th>
                            <Th>Criado por</Th>
                            <Th></Th>
                        </tr>
                    </Thead>
                    <tbody>
                        {communications.map((c) => (
                            <Tr key={c.id}>
                                <Td>{c.subject || <em>(sem assunto)</em>}</Td>
                                <Td>{AUDIENCE_LABEL[c.audience]}</Td>
                                <Td>{c.status === 'DRAFT' ? '—' : c.recipientCount}</Td>
                                <Td>{c.status === 'DRAFT' ? '—' : `${c.openedCount}/${c.recipientCount}`}</Td>
                                <Td><Badge $tone={STATUS_TONE[c.status]}>{STATUS_LABEL[c.status]}</Badge></Td>
                                <Td>
                                    {c.createdBy?.name ?? '—'}
                                    <br />
                                    <small>{formatAppDate(c.createdAt, 'dd/MM/yyyy HH:mm')}</small>
                                </Td>
                                <Td>
                                    <Button $variant="ghost" onClick={() => navigate(`/admin/communications/${c.id}/edit`)}>
                                        {c.status === 'DRAFT' ? 'Editar' : 'Ver detalhes'}
                                    </Button>
                                    {c.status === 'DRAFT' && (
                                        <Button
                                            $variant="ghost"
                                            onClick={() => {
                                                if (confirm(`Excluir o comunicado "${c.subject || '(sem assunto)'}"?`)) removeMutation.mutate(c.id);
                                            }}
                                        >
                                            Excluir
                                        </Button>
                                    )}
                                </Td>
                            </Tr>
                        ))}
                    </tbody>
                </Table>
                {!isLoading && communications.length === 0 && <EmptyState>Nenhum comunicado criado ainda.</EmptyState>}
            </TableWrapper>
        </>
    );
}
