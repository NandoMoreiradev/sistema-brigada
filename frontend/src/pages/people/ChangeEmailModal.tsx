// frontend/src/pages/people/ChangeEmailModal.tsx
//
// Troca o e-mail de login de uma pessoa (ex.: o aluno perdeu o acesso ao e-mail antigo e, por
// isso, nem "Redefinir senha" nem "Reenviar acesso" chegam até ele). O backend encerra as
// sessões abertas e manda o link de acesso para o NOVO endereço — ver UsersService.changeEmail.

import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Field, Label, Input, ErrorText, Form, FormActions, HelpText } from '@/components/ui/FormField';
import { peopleApi } from '@/services/people';
import { toast } from '@/utils/toast';
import type { OrgPerson } from '@/types';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface ChangeEmailModalProps {
    person: OrgPerson | null;
    onClose: () => void;
    /** Recebe a pessoa já com o e-mail novo, para quem estiver mostrando o cadastro dela. */
    onChanged?: (person: OrgPerson) => void;
}

export function ChangeEmailModal({ person, onClose, onChanged }: ChangeEmailModalProps) {
    const queryClient = useQueryClient();
    const [email, setEmail] = useState('');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setEmail('');
        setError(null);
    }, [person?.id]);

    const mutation = useMutation({
        mutationFn: (value: string) => peopleApi.changeEmail(person!.id, value),
        onSuccess: (result) => {
            (result.sent ? toast.success : toast.error)(result.message);
            queryClient.invalidateQueries({ queryKey: ['people'] });
            onChanged?.(result.user);
            onClose();
        },
        onError: (err: any) => toast.error(err?.response?.data?.message || 'Não foi possível alterar o e-mail.'),
    });

    const submit = (event: React.FormEvent) => {
        event.preventDefault();
        const value = email.trim();
        if (!EMAIL_PATTERN.test(value)) {
            setError('Informe um e-mail válido.');
            return;
        }
        if (value.toLowerCase() === person?.email.toLowerCase()) {
            setError('O novo e-mail é igual ao atual.');
            return;
        }
        setError(null);
        if (window.confirm(`Trocar o e-mail de ${person?.name} para ${value}? As sessões abertas dela serão encerradas.`)) {
            mutation.mutate(value);
        }
    };

    return (
        <Modal open={person !== null} onOpenChange={(open) => !open && onClose()} title="Alterar e-mail" width="480px">
            {person && (
                <Form onSubmit={submit}>
                    <Field>
                        <Label>E-mail atual</Label>
                        <Input value={person.email} disabled readOnly />
                    </Field>
                    <Field>
                        <Label htmlFor="newEmail">Novo e-mail</Label>
                        <Input id="newEmail" type="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} />
                        {error && <ErrorText>{error}</ErrorText>}
                    </Field>
                    <HelpText>
                        Ao confirmar, as sessões abertas de {person.name} são encerradas e um link para acessar a conta e definir a senha é enviado
                        para o novo e-mail. Confira o endereço com atenção: quem controla o e-mail controla a conta.
                    </HelpText>
                    <FormActions>
                        <Button type="button" $variant="secondary" onClick={onClose} disabled={mutation.isPending}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={mutation.isPending || email.trim() === ''}>
                            {mutation.isPending ? 'Alterando...' : 'Alterar e-mail'}
                        </Button>
                    </FormActions>
                </Form>
            )}
        </Modal>
    );
}
