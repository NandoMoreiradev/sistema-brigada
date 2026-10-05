// frontend/src/components/trash/TrashModal.tsx
//
// Lixeira de uma entidade (turmas, eventos, pessoas, cargos): lista o que foi excluído e permite
// restaurar ou excluir definitivamente. Regras em backend/src/trash/trash.service.ts.
// `TrashButton` é o ponto de entrada das páginas — já cuida da permissão `trash:manage`.

import { useState } from 'react';
import styled from 'styled-components';
import { Trash2 } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Field, Input, Label, FormActions, HelpText } from '@/components/ui/FormField';
import { Table, TableWrapper, Thead, Tr, Th, Td, EmptyState } from '@/components/ui/Table';
import { trashApi, type TrashEntity, type TrashItem } from '@/services/trash';
import { useAuth } from '@/contexts/AuthContext';
import { hasPermission } from '@/utils/permissions';
import { apiErrorMessage } from '@/utils/apiError';
import { toast } from '@/utils/toast';

const ENTITY_LABEL: Record<TrashEntity, { title: string; singular: string }> = {
    courses: { title: 'Lixeira de turmas', singular: 'turma' },
    events: { title: 'Lixeira de eventos', singular: 'evento' },
    people: { title: 'Lixeira de pessoas', singular: 'pessoa' },
    roles: { title: 'Lixeira de cargos', singular: 'cargo' },
};

/** Listas (react-query) que precisam recarregar depois de restaurar ou excluir. */
const INVALIDATE_KEYS: Record<TrashEntity, string[][]> = {
    courses: [['courses']],
    events: [['events']],
    people: [['people'], ['staff']],
    roles: [['role-assignments'], ['people']],
};

const Text = styled.p`
    margin: 0 0 0.75rem;
    font-size: 0.9rem;
    line-height: 1.5;
    color: ${({ theme }) => theme.colors.textDark};
`;

const List = styled.ul`
    margin: 0 0 0.75rem;
    padding-left: 1.25rem;
    font-size: 0.875rem;
    line-height: 1.6;
    color: ${({ theme }) => theme.colors.textDark};
`;

const Muted = styled.span`
    display: block;
    font-size: 0.75rem;
    color: ${({ theme }) => theme.colors.textMuted};
`;

const RowActions = styled.div`
    display: flex;
    justify-content: flex-end;
    gap: 0.4rem;
`;

const formatDeletedAt = (iso: string) =>
    new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' });

function PurgeConfirm({ entity, item, onBack, onDone }: { entity: TrashEntity; item: TrashItem; onBack: () => void; onDone: () => void }) {
    const [typed, setTyped] = useState('');
    const queryClient = useQueryClient();
    const { singular } = ENTITY_LABEL[entity];

    const { data: check, isLoading, isError } = useQuery({
        queryKey: ['trash', entity, 'purge-check', item.id],
        queryFn: () => trashApi.purgeCheck(entity, item.id),
        staleTime: 0,
        gcTime: 0,
    });

    const purgeMutation = useMutation({
        mutationFn: () => trashApi.purge(entity, item.id),
        onSuccess: (result) => {
            toast.success(result.message);
            queryClient.invalidateQueries({ queryKey: ['trash', entity] });
            INVALIDATE_KEYS[entity].forEach((queryKey) => queryClient.invalidateQueries({ queryKey }));
            onDone();
        },
        onError: (error) => toast.error(apiErrorMessage(error, 'Não foi possível excluir definitivamente.')),
    });

    const confirmed = typed.trim().toLowerCase() === item.name.trim().toLowerCase();

    return (
        <>
            <Text>
                Excluir definitivamente {singular} <strong>{item.name}</strong>? <strong>Esta ação não pode ser desfeita.</strong>
            </Text>

            {isLoading && <Text>Calculando o que será apagado...</Text>}
            {isError && <Text>Não foi possível calcular o que será apagado. Tente novamente.</Text>}
            {check && (check.items.length > 0 || check.files > 0) && (
                <>
                    <Text>Também serão apagados:</Text>
                    <List>
                        {check.items.map((entry) => (
                            <li key={entry.label}>
                                {entry.count} {entry.label}
                            </li>
                        ))}
                        {check.files > 0 && <li>{check.files} arquivo(s) armazenados</li>}
                    </List>
                </>
            )}

            <Field>
                <Label htmlFor="trash-confirm">Digite o nome para confirmar</Label>
                <Input id="trash-confirm" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={item.name} autoComplete="off" />
                <HelpText>A confirmação ignora maiúsculas e minúsculas.</HelpText>
            </Field>

            <FormActions>
                <Button type="button" $variant="secondary" onClick={onBack} disabled={purgeMutation.isPending}>
                    Voltar
                </Button>
                <Button type="button" $variant="danger" onClick={() => purgeMutation.mutate()} disabled={!confirmed || !check || purgeMutation.isPending}>
                    {purgeMutation.isPending ? 'Excluindo...' : 'Excluir definitivamente'}
                </Button>
            </FormActions>
        </>
    );
}

interface TrashModalProps {
    entity: TrashEntity;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function TrashModal({ entity, open, onOpenChange }: TrashModalProps) {
    const queryClient = useQueryClient();
    const [purging, setPurging] = useState<TrashItem | null>(null);
    const { title, singular } = ENTITY_LABEL[entity];

    const { data: items = [], isLoading, isError } = useQuery({
        queryKey: ['trash', entity],
        queryFn: () => trashApi.list(entity),
        enabled: open,
        staleTime: 0,
    });

    const restoreMutation = useMutation({
        mutationFn: (id: string) => trashApi.restore(entity, id),
        onSuccess: (result) => {
            toast.success(result.message);
            result.warnings.forEach((warning) => toast.warning(warning));
            queryClient.invalidateQueries({ queryKey: ['trash', entity] });
            INVALIDATE_KEYS[entity].forEach((queryKey) => queryClient.invalidateQueries({ queryKey }));
        },
        onError: (error) => toast.error(apiErrorMessage(error, 'Não foi possível restaurar.')),
    });

    const handleOpenChange = (next: boolean) => {
        if (!next) setPurging(null);
        onOpenChange(next);
    };

    return (
        <Modal open={open} onOpenChange={handleOpenChange} title={purging ? 'Excluir definitivamente' : title} width="640px">
            {purging ? (
                <PurgeConfirm entity={entity} item={purging} onBack={() => setPurging(null)} onDone={() => setPurging(null)} />
            ) : (
                <>
                    <HelpText style={{ display: 'block', marginBottom: '0.75rem' }}>
                        Itens excluídos ficam aqui até serem restaurados ou excluídos definitivamente.
                    </HelpText>
                    {isLoading && <Text>Carregando...</Text>}
                    {isError && <Text>Não foi possível carregar a lixeira.</Text>}
                    {!isLoading && !isError && items.length === 0 && (
                        <TableWrapper>
                            <EmptyState>A lixeira está vazia.</EmptyState>
                        </TableWrapper>
                    )}
                    {items.length > 0 && (
                        <TableWrapper>
                            <Table>
                                <Thead>
                                    <tr>
                                        <Th>{singular.charAt(0).toUpperCase() + singular.slice(1)}</Th>
                                        <Th>Excluído em</Th>
                                        <Th></Th>
                                    </tr>
                                </Thead>
                                <tbody>
                                    {items.map((item) => (
                                        <Tr key={item.id}>
                                            <Td>
                                                {item.name}
                                                {item.description && <Muted>{item.description}</Muted>}
                                            </Td>
                                            <Td>{formatDeletedAt(item.deletedAt)}</Td>
                                            <Td>
                                                <RowActions>
                                                    <Button
                                                        type="button"
                                                        $variant="secondary"
                                                        onClick={() => restoreMutation.mutate(item.id)}
                                                        disabled={restoreMutation.isPending}
                                                    >
                                                        Restaurar
                                                    </Button>
                                                    <Button type="button" $variant="danger" onClick={() => setPurging(item)} disabled={restoreMutation.isPending}>
                                                        Excluir
                                                    </Button>
                                                </RowActions>
                                            </Td>
                                        </Tr>
                                    ))}
                                </tbody>
                            </Table>
                        </TableWrapper>
                    )}
                </>
            )}
        </Modal>
    );
}

/** Botão "Lixeira" para o cabeçalho das páginas. Só aparece para quem tem `trash:manage` (admins sempre). */
export function TrashButton({ entity }: { entity: TrashEntity }) {
    const { user } = useAuth();
    const [open, setOpen] = useState(false);

    if (!hasPermission(user, 'trash:manage')) return null;

    return (
        <>
            <Button type="button" $variant="secondary" onClick={() => setOpen(true)} title={ENTITY_LABEL[entity].title} aria-label={ENTITY_LABEL[entity].title}>
                <Trash2 size={16} /> Lixeira
            </Button>
            <TrashModal entity={entity} open={open} onOpenChange={setOpen} />
        </>
    );
}
