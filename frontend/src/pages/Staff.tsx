// frontend/src/pages/Staff.tsx
//
// Equipe de atuação (brigadista/bombeiro). Decisão 8 do docs/decisoes.md:
// staff é um papel adicional sobre um `User` já existente, não um cadastro
// próprio — por isso a tela só "promove" alguém que já está em Alunos/Turmas
// (ou foi cadastrado como pessoa qualquer), em vez de ter um formulário de
// cadastro completo aqui.

import { useState } from 'react';
import { ShieldCheck, Plus } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageLayout } from '@/components/layout/PageLayout';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Field, Label, Select, Form, FormActions, ErrorText } from '@/components/ui/FormField';
import { Table, TableWrapper, Thead, Tr, Th, Td, EmptyState, Badge } from '@/components/ui/Table';
import { staffApi } from '@/services/staff';
import { peopleApi } from '@/services/people';
import { toast } from '@/utils/toast';

export default function Staff() {
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedUserId, setSelectedUserId] = useState('');
    const queryClient = useQueryClient();

    const { data: staff, isLoading } = useQuery({ queryKey: ['staff'], queryFn: () => staffApi.list() });
    const { data: peopleData } = useQuery({ queryKey: ['people', {}], queryFn: () => peopleApi.list() });

    const promoteMutation = useMutation({
        mutationFn: (userId: string) => staffApi.promote(userId),
        onSuccess: () => {
            toast.success('Membro adicionado à equipe de atuação.');
            queryClient.invalidateQueries({ queryKey: ['staff'] });
            setModalOpen(false);
            setSelectedUserId('');
        },
        onError: (error: any) => toast.error(error?.response?.data?.message || 'Não foi possível promover este usuário.'),
    });

    const statusMutation = useMutation({
        mutationFn: ({ id, status }: { id: string; status: 'ACTIVE' | 'INACTIVE' }) => staffApi.updateStatus(id, status),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['staff'] });
            toast.success('Status atualizado.');
        },
        onError: (error: any) => toast.error(error?.response?.data?.message || 'Não foi possível atualizar o status.'),
    });

    const currentStaffUserIds = new Set((staff ?? []).map((s) => s.user.id));
    const eligiblePeople = (peopleData?.data ?? []).filter((p) => !currentStaffUserIds.has(p.id));

    return (
        <PageLayout
            title="Equipe"
            subtitle="Brigadistas e bombeiros disponíveis para designação"
            icon={<ShieldCheck size={16} />}
            actions={
                <Button onClick={() => setModalOpen(true)}>
                    <Plus size={16} /> Promover para equipe
                </Button>
            }
        >
            <TableWrapper>
                <Table>
                    <Thead>
                        <tr>
                            <Th>Nome</Th>
                            <Th>E-mail</Th>
                            <Th>Designações</Th>
                            <Th>Status</Th>
                            <Th></Th>
                        </tr>
                    </Thead>
                    <tbody>
                        {(staff ?? []).map((member) => (
                            <Tr key={member.id}>
                                <Td>{member.user.name}</Td>
                                <Td>{member.user.email}</Td>
                                <Td>{member._count.designations}</Td>
                                <Td><Badge $tone={member.status === 'ACTIVE' ? 'success' : 'neutral'}>{member.status === 'ACTIVE' ? 'Ativo' : 'Inativo'}</Badge></Td>
                                <Td>
                                    <Button
                                        $variant="ghost"
                                        onClick={() => statusMutation.mutate({ id: member.id, status: member.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' })}
                                    >
                                        {member.status === 'ACTIVE' ? 'Desativar' : 'Reativar'}
                                    </Button>
                                </Td>
                            </Tr>
                        ))}
                    </tbody>
                </Table>
                {!isLoading && (staff ?? []).length === 0 && <EmptyState>Nenhum membro na equipe de atuação ainda.</EmptyState>}
            </TableWrapper>

            <Modal open={modalOpen} onOpenChange={setModalOpen} title="Promover para equipe de atuação">
                <Form onSubmit={(e) => { e.preventDefault(); if (selectedUserId) promoteMutation.mutate(selectedUserId); }}>
                    <Field>
                        <Label htmlFor="person">Pessoa</Label>
                        <Select id="person" value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)}>
                            <option value="">Selecione</option>
                            {eligiblePeople.map((person) => (
                                <option key={person.id} value={person.id}>{person.name} — {person.email}</option>
                            ))}
                        </Select>
                        {eligiblePeople.length === 0 && (
                            <ErrorText>Todas as pessoas cadastradas já fazem parte da equipe, ou nenhuma pessoa foi cadastrada ainda.</ErrorText>
                        )}
                    </Field>
                    <FormActions>
                        <Button type="button" $variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
                        <Button type="submit" disabled={!selectedUserId || promoteMutation.isPending}>
                            {promoteMutation.isPending ? 'Salvando...' : 'Promover'}
                        </Button>
                    </FormActions>
                </Form>
            </Modal>
        </PageLayout>
    );
}
