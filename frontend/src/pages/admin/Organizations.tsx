// frontend/src/pages/admin/Organizations.tsx
//
// Painel de plataforma — visível apenas para SUPER_ADMIN (ver SuperAdminRoute
// em src/components/common/ProtectedRoute.tsx). Equivalente ao
// AdminController/SchoolOperationsController do maskotCrmEdu, escopado para
// gestão de academias-clientes (decisões 3 e 5 de docs/decisoes.md).

import { useState } from 'react';
import { Building2, Plus } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageLayout } from '@/components/layout/PageLayout';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Field, Label, Input, ErrorText, CheckboxField, Form, FormActions, HelpText } from '@/components/ui/FormField';
import { Table, TableWrapper, Thead, Tr, Th, Td, EmptyState, Badge } from '@/components/ui/Table';
import { organizationsApi, type CreateOrganizationInput } from '@/services/organizations';
import { toast } from '@/utils/toast';
import type { Organization } from '@/types';

const schema = z.object({
    name: z.string().min(1, 'Informe o nome da academia'),
    subdomain: z.string().optional(),
    isMatrix: z.boolean().optional(),
    groupName: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export default function Organizations() {
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<Organization | null>(null);
    const queryClient = useQueryClient();

    const { data, isLoading } = useQuery({
        queryKey: ['organizations'],
        queryFn: () => organizationsApi.list(),
    });

    const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
        resolver: zodResolver(schema),
    });

    const openCreate = () => {
        setEditing(null);
        reset({ name: '', subdomain: '', isMatrix: false, groupName: '' });
        setModalOpen(true);
    };

    const openEdit = (organization: Organization) => {
        setEditing(organization);
        reset({
            name: organization.name,
            subdomain: organization.subdomain || '',
            isMatrix: organization.isMatrix,
            groupName: organization.groupName || '',
        });
        setModalOpen(true);
    };

    const saveMutation = useMutation({
        mutationFn: async (input: CreateOrganizationInput) => {
            if (editing) return organizationsApi.update(editing.id, input);
            return organizationsApi.create(input);
        },
        onSuccess: () => {
            toast.success(editing ? 'Academia atualizada com sucesso.' : 'Academia criada com sucesso.');
            queryClient.invalidateQueries({ queryKey: ['organizations'] });
            setModalOpen(false);
        },
        onError: (error: any) => {
            toast.error(error?.response?.data?.message || 'Não foi possível salvar a academia.');
        },
    });

    const onSubmit = (formData: FormData) => {
        saveMutation.mutate({
            name: formData.name,
            subdomain: formData.subdomain || undefined,
            isMatrix: formData.isMatrix,
            groupName: formData.groupName || undefined,
        });
    };

    const organizations = data?.data ?? [];

    return (
        <PageLayout
            title="Academias"
            subtitle="Gestão de academias-clientes da plataforma"
            icon={<Building2 size={16} />}
            actions={
                <Button onClick={openCreate}>
                    <Plus size={16} /> Nova academia
                </Button>
            }
        >
            <TableWrapper>
                <Table>
                    <Thead>
                        <tr>
                            <Th>Nome</Th>
                            <Th>Subdomínio</Th>
                            <Th>Tipo</Th>
                            <Th>Alunos/usuários</Th>
                            <Th>Turmas</Th>
                            <Th></Th>
                        </tr>
                    </Thead>
                    <tbody>
                        {organizations.map((organization) => (
                            <Tr key={organization.id}>
                                <Td>{organization.name}</Td>
                                <Td>{organization.subdomain || '—'}</Td>
                                <Td>
                                    <Badge $tone={organization.isMatrix ? 'info' : 'neutral'}>
                                        {organization.isMatrix ? 'Matriz' : 'Unidade'}
                                    </Badge>
                                </Td>
                                <Td>{(organization as any)._count?.users ?? 0}</Td>
                                <Td>{(organization as any)._count?.courses ?? 0}</Td>
                                <Td>
                                    <Button $variant="ghost" onClick={() => openEdit(organization)}>
                                        Editar
                                    </Button>
                                </Td>
                            </Tr>
                        ))}
                    </tbody>
                </Table>
                {!isLoading && organizations.length === 0 && (
                    <EmptyState>Nenhuma academia cadastrada ainda.</EmptyState>
                )}
            </TableWrapper>

            <Modal open={modalOpen} onOpenChange={setModalOpen} title={editing ? 'Editar academia' : 'Nova academia'}>
                <Form onSubmit={handleSubmit(onSubmit)}>
                    <Field>
                        <Label htmlFor="name">Nome</Label>
                        <Input id="name" {...register('name')} />
                        {errors.name && <ErrorText>{errors.name.message}</ErrorText>}
                    </Field>

                    <Field>
                        <Label htmlFor="subdomain">Subdomínio (opcional)</Label>
                        <Input id="subdomain" placeholder="ex: sp-central" {...register('subdomain')} />
                        <HelpText>Usado para identificar a academia em integrações futuras.</HelpText>
                    </Field>

                    <Field>
                        <Label htmlFor="groupName">Nome do grupo (opcional)</Label>
                        <Input id="groupName" {...register('groupName')} />
                    </Field>

                    <CheckboxField>
                        <input type="checkbox" {...register('isMatrix')} />
                        É uma academia matriz (tem filiais)
                    </CheckboxField>

                    <FormActions>
                        <Button type="button" $variant="secondary" onClick={() => setModalOpen(false)}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={saveMutation.isPending}>
                            {saveMutation.isPending ? 'Salvando...' : 'Salvar'}
                        </Button>
                    </FormActions>
                </Form>
            </Modal>
        </PageLayout>
    );
}
