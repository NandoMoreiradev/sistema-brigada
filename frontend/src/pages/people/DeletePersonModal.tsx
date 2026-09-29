// frontend/src/pages/people/DeletePersonModal.tsx
//
// Exclusão de pessoa. Antes de confirmar, pergunta ao backend o que impede a exclusão
// (GET /users/:id/deletion-check): quem já tem histórico (matrícula, certificado, escala,
// ocorrência...) não pode ser excluído, e a alternativa oferecida aqui é desativar — que
// preserva tudo. Regras em backend/src/users/user-deletion.service.ts.

import styled from 'styled-components';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { FormActions, HelpText } from '@/components/ui/FormField';
import { peopleApi } from '@/services/people';
import { toast } from '@/utils/toast';
import type { OrgPerson } from '@/types';

const Text = styled.p`
    margin: 0 0 0.75rem;
    font-size: 0.9rem;
    line-height: 1.5;
    color: ${({ theme }) => theme.colors.textDark};
`;

const BlockerList = styled.ul`
    margin: 0 0 0.75rem;
    padding-left: 1.25rem;
    font-size: 0.875rem;
    line-height: 1.6;
    color: ${({ theme }) => theme.colors.textDark};
`;

interface DeletePersonModalProps {
    person: OrgPerson | null;
    onClose: () => void;
}

export function DeletePersonModal({ person, onClose }: DeletePersonModalProps) {
    const queryClient = useQueryClient();

    const { data: check, isLoading, isError } = useQuery({
        queryKey: ['people', 'deletion-check', person?.id],
        queryFn: () => peopleApi.checkDeletion(person!.id),
        enabled: person !== null,
        // Sempre reconfere ao abrir: uma matrícula pode ter sido criada desde a última vez.
        staleTime: 0,
        gcTime: 0,
    });

    const invalidatePeople = () => {
        queryClient.invalidateQueries({ queryKey: ['people'] });
        queryClient.invalidateQueries({ queryKey: ['staff'] });
    };

    const removeMutation = useMutation({
        mutationFn: (id: string) => peopleApi.remove(id),
        onSuccess: (result) => {
            toast.success(result.message);
            invalidatePeople();
            onClose();
        },
        onError: (error: any) => {
            toast.error(error?.response?.data?.message || 'Não foi possível excluir a pessoa.');
            // Um bloqueio novo (409) muda o que a tela mostra.
            queryClient.invalidateQueries({ queryKey: ['people', 'deletion-check', person?.id] });
        },
    });

    const deactivateMutation = useMutation({
        mutationFn: (id: string) => peopleApi.update(id, { isActive: false }),
        onSuccess: () => {
            toast.success('Pessoa desativada. O histórico foi preservado.');
            invalidatePeople();
            onClose();
        },
        onError: (error: any) => toast.error(error?.response?.data?.message || 'Não foi possível desativar a pessoa.'),
    });

    const busy = removeMutation.isPending || deactivateMutation.isPending;

    return (
        <Modal open={person !== null} onOpenChange={(open) => !open && onClose()} title="Excluir pessoa" width="480px">
            {person && (
                <>
                    {isLoading && <Text>Verificando o histórico de {person.name}...</Text>}
                    {isError && <Text>Não foi possível verificar se {person.name} pode ser excluído(a). Tente novamente.</Text>}

                    {check?.canDelete && (
                        <>
                            <Text>
                                Excluir <strong>{person.name}</strong> remove o acesso ao sistema e libera o e-mail {person.email} para um novo cadastro.
                                Perfil, cargos e notificações da pessoa também são removidos.
                            </Text>
                            <HelpText>Como não há histórico vinculado, nada mais é afetado.</HelpText>
                        </>
                    )}

                    {check && !check.canDelete && (
                        <>
                            <Text>
                                <strong>{person.name}</strong> não pode ser excluído(a) porque tem histórico no sistema:
                            </Text>
                            <BlockerList>
                                {check.blockers.map((blocker) => (
                                    <li key={blocker.code}>{blocker.message}</li>
                                ))}
                            </BlockerList>
                            <HelpText>
                                {check.isActive
                                    ? 'Desativar bloqueia o acesso e mantém todo o histórico intacto.'
                                    : 'A pessoa já está inativa: o acesso está bloqueado e o histórico preservado.'}
                            </HelpText>
                        </>
                    )}

                    <FormActions>
                        <Button type="button" $variant="secondary" onClick={onClose} disabled={busy}>
                            Cancelar
                        </Button>
                        {check && !check.canDelete && check.isActive && (
                            <Button type="button" onClick={() => deactivateMutation.mutate(person.id)} disabled={busy}>
                                {deactivateMutation.isPending ? 'Desativando...' : 'Desativar pessoa'}
                            </Button>
                        )}
                        {check?.canDelete && (
                            <Button type="button" $variant="danger" onClick={() => removeMutation.mutate(person.id)} disabled={busy}>
                                {removeMutation.isPending ? 'Excluindo...' : 'Excluir definitivamente'}
                            </Button>
                        )}
                    </FormActions>
                </>
            )}
        </Modal>
    );
}
