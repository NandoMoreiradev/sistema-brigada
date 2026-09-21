// frontend/src/pages/Roles.tsx
//
// Gestão de cargos (RoleAssignment) e atribuição a pessoas — a UI que ativa
// o sistema de permissões granulares do backend (backend/src/permissions/),
// até agora dormant. Cargo = nome + conjunto de permissões (catálogo fixo,
// ver permissions.catalog.ts); atribuir um cargo a alguém que não é
// ORG_ADMIN dá a ela acesso administrativo só naquele recorte (ex: só
// "courses:manage", sem "certificates:manage").

import { useState } from 'react';
import { ShieldCheck, Plus, Pencil, Trash2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageLayout } from '@/components/layout/PageLayout';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Field, Label, Input, Select, Form, FormActions, ErrorText, HelpText } from '@/components/ui/FormField';
import { Table, TableWrapper, Thead, Tr, Th, Td, EmptyState } from '@/components/ui/Table';
import { permissionsApi, roleAssignmentsApi, type GroupedPermissions, type RoleAssignment } from '@/services/permissions';
import { peopleApi } from '@/services/people';
import { toast } from '@/utils/toast';
import type { OrgPerson } from '@/types';

interface RoleFormData {
    name: string;
    permissionIds: string[];
}

/** Checklist de permissões agrupada por módulo — reaproveitada pelo formulário
 * de cargo e pela modal de permissões diretas por pessoa. */
function PermissionChecklist({
    groupedPermissions,
    selectedIds,
    onToggle,
}: {
    groupedPermissions: GroupedPermissions | undefined;
    selectedIds: string[];
    onToggle: (id: string) => void;
}) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: 280, overflowY: 'auto' }}>
            {Object.entries(groupedPermissions ?? {}).map(([module, permissions]) => (
                <div key={module}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: '#6c757d', marginBottom: '0.25rem' }}>
                        {module}
                    </div>
                    {permissions.map((permission) => (
                        <label key={permission.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', padding: '0.2rem 0' }}>
                            <input type="checkbox" checked={selectedIds.includes(permission.id)} onChange={() => onToggle(permission.id)} />
                            {permission.name}
                        </label>
                    ))}
                </div>
            ))}
        </div>
    );
}

export default function Roles() {
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<RoleAssignment | null>(null);
    const [directPermModalOpen, setDirectPermModalOpen] = useState(false);
    const [editingPerson, setEditingPerson] = useState<OrgPerson | null>(null);
    const [directPermissionIds, setDirectPermissionIds] = useState<string[]>([]);
    const queryClient = useQueryClient();

    const { data: roleAssignments, isLoading } = useQuery({
        queryKey: ['role-assignments'],
        queryFn: () => roleAssignmentsApi.list(),
    });
    const { data: groupedPermissions } = useQuery({
        queryKey: ['permissions'],
        queryFn: () => permissionsApi.listGrouped(),
    });
    const { data: peopleData } = useQuery({ queryKey: ['people', {}], queryFn: () => peopleApi.list() });

    const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<RoleFormData>({
        defaultValues: { name: '', permissionIds: [] },
    });
    const selectedPermissionIds = watch('permissionIds') ?? [];

    const openCreate = () => {
        setEditing(null);
        reset({ name: '', permissionIds: [] });
        setModalOpen(true);
    };

    const openEdit = (role: RoleAssignment) => {
        setEditing(role);
        reset({ name: role.name, permissionIds: role.permissions.map((p) => p.id) });
        setModalOpen(true);
    };

    const saveMutation = useMutation({
        mutationFn: (data: RoleFormData) =>
            editing ? roleAssignmentsApi.update(editing.id, data) : roleAssignmentsApi.create(data),
        onSuccess: () => {
            toast.success(editing ? 'Cargo atualizado.' : 'Cargo criado.');
            queryClient.invalidateQueries({ queryKey: ['role-assignments'] });
            setModalOpen(false);
        },
        onError: (error: any) => toast.error(error?.response?.data?.message || 'Não foi possível salvar o cargo.'),
    });

    const removeMutation = useMutation({
        mutationFn: (id: string) => roleAssignmentsApi.remove(id),
        onSuccess: () => {
            toast.success('Cargo excluído.');
            queryClient.invalidateQueries({ queryKey: ['role-assignments'] });
        },
        onError: (error: any) => toast.error(error?.response?.data?.message || 'Não foi possível excluir o cargo.'),
    });

    const assignMutation = useMutation({
        mutationFn: ({ userId, roleAssignmentId }: { userId: string; roleAssignmentId: string | null }) =>
            peopleApi.setRoleAssignment(userId, roleAssignmentId),
        onSuccess: () => {
            toast.success('Cargo atribuído.');
            queryClient.invalidateQueries({ queryKey: ['people'] });
        },
        onError: (error: any) => toast.error(error?.response?.data?.message || 'Não foi possível atribuir o cargo.'),
    });

    const openDirectPermissions = (person: OrgPerson) => {
        setEditingPerson(person);
        setDirectPermissionIds(person.directPermissions ?? []);
        setDirectPermModalOpen(true);
    };

    const toggleDirectPermission = (id: string) => {
        setDirectPermissionIds((current) => (current.includes(id) ? current.filter((p) => p !== id) : [...current, id]));
    };

    const directPermissionsMutation = useMutation({
        mutationFn: () => peopleApi.setDirectPermissions(editingPerson!.id, directPermissionIds),
        onSuccess: () => {
            toast.success('Permissões diretas atualizadas.');
            queryClient.invalidateQueries({ queryKey: ['people'] });
            setDirectPermModalOpen(false);
        },
        onError: (error: any) => toast.error(error?.response?.data?.message || 'Não foi possível atualizar as permissões.'),
    });

    const togglePermission = (id: string) => {
        const current = selectedPermissionIds;
        setValue('permissionIds', current.includes(id) ? current.filter((p) => p !== id) : [...current, id], {
            shouldValidate: true,
        });
    };

    const people = peopleData?.data ?? [];

    return (
        <PageLayout title="Cargos" subtitle="Permissões da equipe administrativa" icon={<ShieldCheck size={16} />}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.75rem' }}>
                <Button onClick={openCreate}>
                    <Plus size={16} /> Novo cargo
                </Button>
            </div>

            <TableWrapper>
                <Table>
                    <Thead>
                        <tr>
                            <Th>Cargo</Th>
                            <Th>Permissões</Th>
                            <Th>Pessoas</Th>
                            <Th></Th>
                        </tr>
                    </Thead>
                    <tbody>
                        {(roleAssignments ?? []).map((role) => (
                            <Tr key={role.id}>
                                <Td>{role.name}</Td>
                                <Td>{role.permissions.map((p) => p.name).join(', ') || '—'}</Td>
                                <Td>{role._count.users}</Td>
                                <Td>
                                    <Button $variant="ghost" onClick={() => openEdit(role)}>
                                        <Pencil size={14} /> Editar
                                    </Button>
                                    {role.isDeletable && (
                                        <Button $variant="ghost" onClick={() => removeMutation.mutate(role.id)}>
                                            <Trash2 size={14} />
                                        </Button>
                                    )}
                                </Td>
                            </Tr>
                        ))}
                    </tbody>
                </Table>
                {!isLoading && (roleAssignments ?? []).length === 0 && <EmptyState>Nenhum cargo cadastrado ainda.</EmptyState>}
            </TableWrapper>

            <div style={{ marginTop: '1.5rem', marginBottom: '0.5rem', fontWeight: 700, fontSize: '0.9375rem' }}>
                Pessoas
            </div>
            <TableWrapper>
                <Table>
                    <Thead>
                        <tr>
                            <Th>Nome</Th>
                            <Th>E-mail</Th>
                            <Th>Cargo atual</Th>
                            <Th>Permissões diretas</Th>
                            <Th></Th>
                        </tr>
                    </Thead>
                    <tbody>
                        {people.map((person) => (
                            <Tr key={person.id}>
                                <Td>{person.name}</Td>
                                <Td>{person.email}</Td>
                                <Td>
                                    <Select
                                        value={person.roleAssignments?.[0]?.id ?? ''}
                                        onChange={(e) =>
                                            assignMutation.mutate({ userId: person.id, roleAssignmentId: e.target.value || null })
                                        }
                                    >
                                        <option value="">Sem cargo</option>
                                        {(roleAssignments ?? []).map((role) => (
                                            <option key={role.id} value={role.id}>{role.name}</option>
                                        ))}
                                    </Select>
                                </Td>
                                <Td>{person.directPermissions?.length ? `${person.directPermissions.length} permissão(ões)` : '—'}</Td>
                                <Td>
                                    <Button $variant="ghost" onClick={() => openDirectPermissions(person)}>
                                        <Pencil size={14} /> Editar
                                    </Button>
                                </Td>
                            </Tr>
                        ))}
                    </tbody>
                </Table>
                {people.length === 0 && <EmptyState>Nenhuma pessoa cadastrada ainda.</EmptyState>}
            </TableWrapper>

            <Modal
                open={directPermModalOpen}
                onOpenChange={setDirectPermModalOpen}
                title={`Permissões diretas — ${editingPerson?.name ?? ''}`}
                width="560px"
            >
                <HelpText>
                    Permissões concedidas direto à pessoa, além (ou no lugar) do cargo dela. Use pra um caso pontual, sem
                    precisar criar um cargo novo.
                </HelpText>
                <PermissionChecklist groupedPermissions={groupedPermissions} selectedIds={directPermissionIds} onToggle={toggleDirectPermission} />
                <FormActions>
                    <Button type="button" $variant="secondary" onClick={() => setDirectPermModalOpen(false)}>Cancelar</Button>
                    <Button type="button" onClick={() => directPermissionsMutation.mutate()} disabled={directPermissionsMutation.isPending}>
                        {directPermissionsMutation.isPending ? 'Salvando...' : 'Salvar'}
                    </Button>
                </FormActions>
            </Modal>

            <Modal open={modalOpen} onOpenChange={setModalOpen} title={editing ? 'Editar cargo' : 'Novo cargo'} width="560px">
                <Form onSubmit={handleSubmit((data) => saveMutation.mutate(data))}>
                    <Field>
                        <Label htmlFor="name">Nome do cargo</Label>
                        <Input id="name" placeholder="ex: Secretaria" {...register('name', { required: 'Informe o nome do cargo' })} />
                        {errors.name && <ErrorText>{errors.name.message}</ErrorText>}
                    </Field>

                    <Field>
                        <Label>Permissões</Label>
                        <PermissionChecklist groupedPermissions={groupedPermissions} selectedIds={selectedPermissionIds} onToggle={togglePermission} />
                        {selectedPermissionIds.length === 0 && <ErrorText>Selecione ao menos uma permissão.</ErrorText>}
                    </Field>

                    <FormActions>
                        <Button type="button" $variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
                        <Button type="submit" disabled={selectedPermissionIds.length === 0 || saveMutation.isPending}>
                            {saveMutation.isPending ? 'Salvando...' : 'Salvar'}
                        </Button>
                    </FormActions>
                </Form>
            </Modal>
        </PageLayout>
    );
}
