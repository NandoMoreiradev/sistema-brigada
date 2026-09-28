// frontend/src/pages/Registrations.tsx
//
// Revisão dos cadastros públicos pendentes (ver settings/OrganizationTab.tsx, seção
// "Autocadastro público") — permissão própria registrations:manage, gated no Router.tsx.
// "Aprovar" abre um modal pré-preenchido com o que a pessoa enviou, editável antes de
// confirmar (cobre campos que a academia não expôs no formulário público mas quer
// registrar); "Recusar" é uma ação direta com confirmação, sem criar conta nem enviar
// e-mail (RegistrationsService.reject).

import { useState } from 'react';
import { UserPlus } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { PageLayout } from '@/components/layout/PageLayout';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Field, Label, Input, Select, Form, FormActions, HelpText, FieldRow } from '@/components/ui/FormField';
import { Table, TableWrapper, Thead, Tr, Th, Td, EmptyState, Badge } from '@/components/ui/Table';
import { registrationsApi } from '@/services/registrations';
import { toast } from '@/utils/toast';
import type { RegistrationRequest } from '@/types';

const STATUS_LABEL: Record<RegistrationRequest['status'], string> = {
    PENDING: 'Pendente',
    APPROVED: 'Aprovado',
    REJECTED: 'Recusado',
};

const STATUS_TONE: Record<RegistrationRequest['status'], 'warning' | 'success' | 'danger'> = {
    PENDING: 'warning',
    APPROVED: 'success',
    REJECTED: 'danger',
};

const approveSchema = z.object({
    baptismDate: z.string().optional(),
    pioneerStatus: z.enum(['', 'AUXILIARY', 'REGULAR']).optional(),
    signedPetitions: z.string().optional(),
    profession: z.string().optional(),
});
type ApproveFormData = z.infer<typeof approveSchema>;

export default function Registrations() {
    const queryClient = useQueryClient();
    const [statusFilter, setStatusFilter] = useState<'PENDING' | 'APPROVED' | 'REJECTED'>('PENDING');
    const [approving, setApproving] = useState<RegistrationRequest | null>(null);

    const { data, isLoading } = useQuery({
        queryKey: ['registrations', statusFilter],
        queryFn: () => registrationsApi.list(statusFilter),
    });
    const requests = data?.data ?? [];

    const { register, handleSubmit, reset } = useForm<ApproveFormData>({
        resolver: zodResolver(approveSchema),
        defaultValues: { baptismDate: '', pioneerStatus: '', signedPetitions: '', profession: '' },
    });

    const openApprove = (request: RegistrationRequest) => {
        setApproving(request);
        reset({
            baptismDate: request.baptismDate ? request.baptismDate.slice(0, 10) : '',
            pioneerStatus: request.pioneerStatus ?? '',
            signedPetitions: request.signedPetitions.join(', '),
            profession: request.profession ?? '',
        });
    };

    const approveMutation = useMutation({
        mutationFn: ({ id, data }: { id: string; data: ApproveFormData }) =>
            registrationsApi.approve(id, {
                baptismDate: data.baptismDate || undefined,
                pioneerStatus: data.pioneerStatus || undefined,
                signedPetitions: data.signedPetitions
                    ? data.signedPetitions.split(',').map((item) => item.trim()).filter(Boolean)
                    : undefined,
                profession: data.profession || undefined,
            }),
        onSuccess: () => {
            toast.success('Cadastro aprovado — a pessoa vai receber um e-mail com os dados de acesso.');
            queryClient.invalidateQueries({ queryKey: ['registrations'] });
            setApproving(null);
        },
        onError: (error: any) => toast.error(error?.response?.data?.message || 'Não foi possível aprovar o cadastro.'),
    });

    const rejectMutation = useMutation({
        mutationFn: (id: string) => registrationsApi.reject(id),
        onSuccess: () => {
            toast.success('Cadastro recusado.');
            queryClient.invalidateQueries({ queryKey: ['registrations'] });
        },
        onError: (error: any) => toast.error(error?.response?.data?.message || 'Não foi possível recusar o cadastro.'),
    });

    return (
        <PageLayout
            title="Cadastros pendentes"
            subtitle="Solicitações de autocadastro público aguardando revisão"
            icon={<UserPlus size={16} />}
            actions={
                <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)} style={{ width: '180px' }}>
                    <option value="PENDING">Pendentes</option>
                    <option value="APPROVED">Aprovados</option>
                    <option value="REJECTED">Recusados</option>
                </Select>
            }
        >
            <TableWrapper>
                <Table>
                    <Thead>
                        <tr>
                            <Th>Nome</Th>
                            <Th>E-mail</Th>
                            <Th>Telefone</Th>
                            <Th>Enviado em</Th>
                            <Th>Status</Th>
                            <Th></Th>
                        </tr>
                    </Thead>
                    <tbody>
                        {requests.map((request) => (
                            <Tr key={request.id}>
                                <Td>{request.name}</Td>
                                <Td>{request.email}</Td>
                                <Td>{request.phone}</Td>
                                <Td>{format(new Date(request.createdAt), 'dd/MM/yyyy HH:mm')}</Td>
                                <Td><Badge $tone={STATUS_TONE[request.status]}>{STATUS_LABEL[request.status]}</Badge></Td>
                                <Td>
                                    {request.status === 'PENDING' && (
                                        <>
                                            <Button $variant="ghost" onClick={() => openApprove(request)}>
                                                Aprovar
                                            </Button>
                                            <Button
                                                $variant="ghost"
                                                disabled={rejectMutation.isPending}
                                                onClick={() => {
                                                    if (window.confirm(`Recusar o cadastro de ${request.name}?`)) {
                                                        rejectMutation.mutate(request.id);
                                                    }
                                                }}
                                            >
                                                Recusar
                                            </Button>
                                        </>
                                    )}
                                </Td>
                            </Tr>
                        ))}
                    </tbody>
                </Table>
                {!isLoading && requests.length === 0 && <EmptyState>Nenhum cadastro por aqui.</EmptyState>}
            </TableWrapper>

            <Modal open={!!approving} onOpenChange={(open) => !open && setApproving(null)} title={`Aprovar cadastro de ${approving?.name ?? ''}`} width="480px">
                <Form
                    onSubmit={handleSubmit((data) => {
                        if (approving) approveMutation.mutate({ id: approving.id, data });
                    })}
                >
                    <HelpText>
                        Complete ou ajuste os dados abaixo antes de aprovar — a conta é criada exatamente com o que estiver aqui e a
                        pessoa recebe um e-mail com o link de acesso.
                    </HelpText>

                    <FieldRow>
                        <Field>
                            <Label htmlFor="approve-baptismDate">Data de batismo</Label>
                            <Input id="approve-baptismDate" type="date" {...register('baptismDate')} />
                        </Field>
                        <Field>
                            <Label htmlFor="approve-pioneerStatus">Pioneiro</Label>
                            <Select id="approve-pioneerStatus" {...register('pioneerStatus')}>
                                <option value="">Não é pioneiro</option>
                                <option value="AUXILIARY">Pioneiro auxiliar</option>
                                <option value="REGULAR">Pioneiro regular</option>
                            </Select>
                        </Field>
                    </FieldRow>

                    <Field>
                        <Label htmlFor="approve-profession">Profissão ou área de estudo</Label>
                        <Input id="approve-profession" {...register('profession')} />
                    </Field>

                    <Field>
                        <Label htmlFor="approve-signedPetitions">Petições assinadas</Label>
                        <Input id="approve-signedPetitions" placeholder="Ex: Pioneiro regular, Emissário" {...register('signedPetitions')} />
                        <HelpText>Separe múltiplas petições por vírgula.</HelpText>
                    </Field>

                    <FormActions>
                        <Button type="button" $variant="secondary" onClick={() => setApproving(null)}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={approveMutation.isPending}>
                            {approveMutation.isPending ? 'Aprovando...' : 'Aprovar e criar conta'}
                        </Button>
                    </FormActions>
                </Form>
            </Modal>
        </PageLayout>
    );
}
