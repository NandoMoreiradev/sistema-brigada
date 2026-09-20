// frontend/src/pages/admin/Organizations.tsx
//
// Painel de plataforma — visível apenas para SUPER_ADMIN (ver SuperAdminRoute
// em src/components/common/ProtectedRoute.tsx). Equivalente ao
// AdminController/SchoolOperationsController do maskotCrmEdu, escopado para
// gestão de academias-clientes (decisões 3 e 5 de docs/decisoes.md).

import { useState } from 'react';
import { Building2, Plus } from 'lucide-react';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import styled from 'styled-components';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageLayout } from '@/components/layout/PageLayout';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Field, Label, Input, ErrorText, CheckboxField, Form, FormActions, HelpText } from '@/components/ui/FormField';
import { Table, TableWrapper, Thead, Tr, Th, Td, EmptyState, Badge } from '@/components/ui/Table';
import { organizationsApi, type CreateOrganizationInput, type UpdateOrganizationInput } from '@/services/organizations';
import { toast } from '@/utils/toast';
import { useAuth } from '@/contexts/AuthContext';
import type { Organization } from '@/types';

// Dois schemas em vez de um `z.object` com `.refine()` condicional: adminName/adminEmail só
// existem na criação (ver CreateOrganizationInput), e o resolver do useForm troca entre eles
// conforme `editing` — mais simples do que fechar sobre estado mutável dentro de um refine.
const baseFields = {
    name: z.string().min(1, 'Informe o nome da academia'),
    subdomain: z.string().optional(),
    isMatrix: z.boolean().optional(),
    groupName: z.string().optional(),
    resendApiKey: z.string().optional(),
    emailFromAddress: z.string().email('E-mail inválido').optional().or(z.literal('')),
    emailFromName: z.string().optional(),
};

const createSchema = z.object({
    ...baseFields,
    adminName: z.string().min(1, 'Informe o nome do administrador'),
    adminEmail: z.string().min(1, 'Informe o e-mail do administrador').email('E-mail inválido'),
});

const editSchema = z.object(baseFields);

type FormData = z.infer<typeof createSchema>;

const SectionTitle = styled.h4`
    margin: 0.5rem 0 -0.25rem;
    font-size: 0.8125rem;
    font-weight: 700;
    color: ${({ theme }) => theme.colors.textDark};
    border-top: 1px solid #e9ecef;
    padding-top: 1rem;
`;

export default function Organizations() {
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<Organization | null>(null);
    const queryClient = useQueryClient();
    const { startImpersonation } = useAuth();

    const { data, isLoading } = useQuery({
        queryKey: ['organizations'],
        queryFn: () => organizationsApi.list(),
    });

    // editSchema não tem adminName/adminEmail (só existem na criação) — o resolver muda
    // conforme `editing`, mas os dois validam o mesmo `FormData` na prática (o formulário só
    // renderiza os campos de admin quando !editing), daí o cast.
    const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
        resolver: (editing ? zodResolver(editSchema) : zodResolver(createSchema)) as Resolver<FormData>,
    });

    const openCreate = () => {
        setEditing(null);
        reset({ name: '', subdomain: '', isMatrix: false, groupName: '', adminName: '', adminEmail: '' });
        setModalOpen(true);
    };

    const openEdit = (organization: Organization) => {
        setEditing(organization);
        reset({
            name: organization.name,
            subdomain: organization.subdomain || '',
            isMatrix: organization.isMatrix,
            groupName: organization.groupName || '',
            resendApiKey: '',
            emailFromAddress: organization.emailFromAddress || '',
            emailFromName: organization.emailFromName || '',
        });
        setModalOpen(true);
    };

    const saveMutation = useMutation({
        mutationFn: async (input: CreateOrganizationInput | UpdateOrganizationInput) => {
            if (editing) return organizationsApi.update(editing.id, input as UpdateOrganizationInput);
            return organizationsApi.create(input as CreateOrganizationInput);
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

    const removeMutation = useMutation({
        mutationFn: (id: string) => organizationsApi.remove(id),
        onSuccess: () => {
            toast.success('Academia removida com sucesso.');
            queryClient.invalidateQueries({ queryKey: ['organizations'] });
        },
        onError: (error: any) => {
            toast.error(error?.response?.data?.message || 'Não foi possível remover a academia.');
        },
    });

    const handleRemove = (organization: Organization) => {
        if (confirm(`Remover a academia "${organization.name}"? Isso também desativa os usuários, turmas e eventos dela.`)) {
            removeMutation.mutate(organization.id);
        }
    };

    const impersonateMutation = useMutation({
        mutationFn: (organization: Organization) => organizationsApi.impersonate(organization.id),
        onSuccess: (data, organization) => {
            startImpersonation({
                accessToken: data.access_token,
                organizationId: organization.id,
                organizationName: organization.name,
            });
        },
        onError: (error: any) => {
            toast.error(error?.response?.data?.message || 'Não foi possível acessar como esta academia.');
        },
    });

    const onSubmit = (formData: FormData) => {
        if (editing) {
            saveMutation.mutate({
                name: formData.name,
                subdomain: formData.subdomain || undefined,
                isMatrix: formData.isMatrix,
                groupName: formData.groupName || undefined,
                resendApiKey: formData.resendApiKey || undefined,
                emailFromAddress: formData.emailFromAddress || undefined,
                emailFromName: formData.emailFromName || undefined,
            });
            return;
        }

        saveMutation.mutate({
            name: formData.name,
            adminName: formData.adminName!,
            adminEmail: formData.adminEmail!,
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
                                    <Button
                                        $variant="secondary"
                                        disabled={impersonateMutation.isPending}
                                        onClick={() => impersonateMutation.mutate(organization)}
                                    >
                                        Acessar como
                                    </Button>
                                    <Button $variant="ghost" onClick={() => openEdit(organization)}>
                                        Editar
                                    </Button>
                                    <Button
                                        $variant="danger"
                                        disabled={removeMutation.isPending}
                                        onClick={() => handleRemove(organization)}
                                    >
                                        Remover
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

                    {!editing && (
                        <>
                            <SectionTitle>Administrador da academia</SectionTitle>
                            <Field>
                                <Label htmlFor="adminName">Nome do administrador</Label>
                                <Input id="adminName" {...register('adminName')} />
                                {errors.adminName && <ErrorText>{errors.adminName.message}</ErrorText>}
                            </Field>
                            <Field>
                                <Label htmlFor="adminEmail">E-mail do administrador</Label>
                                <Input id="adminEmail" type="email" {...register('adminEmail')} />
                                {errors.adminEmail && <ErrorText>{errors.adminEmail.message}</ErrorText>}
                                <HelpText>Essa pessoa recebe um e-mail para definir a própria senha e acessar como administradora da academia.</HelpText>
                            </Field>
                        </>
                    )}

                    {editing && (
                        <>
                            <SectionTitle>Configurações de e-mail</SectionTitle>
                            <Field>
                                <Label htmlFor="resendApiKey">Chave Resend própria (opcional)</Label>
                                <Input
                                    id="resendApiKey"
                                    type="password"
                                    placeholder={editing.hasCustomResendKey ? 'Configurada — digite para trocar' : 're_...'}
                                    {...register('resendApiKey')}
                                />
                                <HelpText>
                                    {editing.hasCustomResendKey
                                        ? 'Esta academia já tem uma chave Resend própria configurada. Deixe em branco para mantê-la.'
                                        : 'Sem chave própria, os e-mails desta academia saem pela conta compartilhada da plataforma.'}
                                </HelpText>
                            </Field>
                            <Field>
                                <Label htmlFor="emailFromAddress">E-mail de remetente (opcional)</Label>
                                <Input id="emailFromAddress" type="email" placeholder="contato@suaacademia.com.br" {...register('emailFromAddress')} />
                                {errors.emailFromAddress && <ErrorText>{errors.emailFromAddress.message}</ErrorText>}
                            </Field>
                            <Field>
                                <Label htmlFor="emailFromName">Nome de remetente (opcional)</Label>
                                <Input id="emailFromName" {...register('emailFromName')} />
                            </Field>
                        </>
                    )}

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
