// frontend/src/pages/Staff.tsx
//
// Equipe de atuação (brigadista/bombeiro). Decisão 8 do docs/decisoes.md:
// staff é um papel adicional sobre um `User` já existente, não um cadastro
// próprio — por isso a tela só "promove" alguém que já está em Alunos/Turmas
// (ou foi cadastrado como pessoa qualquer), em vez de ter um formulário de
// cadastro completo aqui.
//
// Certificação externa (decisões 10/32): registro manual de uma qualificação
// que a pessoa já trazia de fora (ex: já é Bombeiro Civil ou Brigadista
// Intermediário antes de entrar nesta academia). Presa ao `User`
// (`POST /users/:id/external-certifications`), não ao `StaffMember` — é um
// fato sobre a pessoa, não sobre este papel — por isso o modal abaixo lê e
// grava via `peopleApi`, e só usa o `member.user.id` daqui.

import { useState } from 'react';
import { ShieldCheck, Plus, Award } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageLayout } from '@/components/layout/PageLayout';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Field, Label, Input, Select, Form, FormActions, ErrorText, FieldRow, HelpText } from '@/components/ui/FormField';
import { Table, TableWrapper, Thead, Tr, Th, Td, EmptyState, Badge } from '@/components/ui/Table';
import { staffApi, type StaffMember } from '@/services/staff';
import { peopleApi } from '@/services/people';
import { mediaApi } from '@/services/media';
import { toast } from '@/utils/toast';
import { useAuth } from '@/contexts/AuthContext';
import { hasPermission } from '@/utils/permissions';

/** Datas de certificação são só "dia" (sem hora) — evita reformatar via timezone e sofrer off-by-one. */
function formatDateOnly(iso: string | null) {
    if (!iso) return '—';
    const [year, month, day] = iso.slice(0, 10).split('-');
    return `${day}/${month}/${year}`;
}

function isExpired(expiresAt: string | null) {
    if (!expiresAt) return false;
    return new Date(expiresAt).getTime() < Date.now();
}

type CertFormData = {
    name: string;
    issuingOrg?: string;
    issuedAt?: string;
    expiresAt?: string;
};

function CertificationsModal({ member, onClose }: { member: StaffMember; onClose: () => void }) {
    const queryClient = useQueryClient();
    const [file, setFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const { register, handleSubmit, reset, formState: { errors } } = useForm<CertFormData>();

    const addMutation = useMutation({
        mutationFn: async (formData: CertFormData) => {
            let proofFileKey: string | undefined;
            if (file) {
                setIsUploading(true);
                try {
                    const { storageKey } = await mediaApi.upload(file, 'external-certifications');
                    proofFileKey = storageKey;
                } finally {
                    setIsUploading(false);
                }
            }
            return peopleApi.addExternalCertification(member.user.id, {
                name: formData.name,
                issuingOrg: formData.issuingOrg || undefined,
                issuedAt: formData.issuedAt || undefined,
                expiresAt: formData.expiresAt || undefined,
                proofFileKey,
            });
        },
        onSuccess: () => {
            toast.success('Certificação registrada com sucesso.');
            queryClient.invalidateQueries({ queryKey: ['staff'] });
            reset({ name: '', issuingOrg: '', issuedAt: '', expiresAt: '' });
            setFile(null);
        },
        onError: (error: any) => toast.error(error?.response?.data?.message || 'Não foi possível registrar a certificação.'),
    });

    return (
        <Modal open onOpenChange={(open) => !open && onClose()} title={`Certificações — ${member.user.name}`} width="600px">
            <TableWrapper>
                <Table>
                    <Thead>
                        <tr>
                            <Th>Certificação</Th>
                            <Th>Órgão emissor</Th>
                            <Th>Emitida em</Th>
                            <Th>Validade</Th>
                        </tr>
                    </Thead>
                    <tbody>
                        {member.user.externalCertifications.map((cert) => (
                            <Tr key={cert.id}>
                                <Td>{cert.name}</Td>
                                <Td>{cert.issuingOrg || '—'}</Td>
                                <Td>{formatDateOnly(cert.issuedAt)}</Td>
                                <Td>
                                    {cert.expiresAt ? (
                                        <Badge $tone={isExpired(cert.expiresAt) ? 'danger' : 'success'}>
                                            {formatDateOnly(cert.expiresAt)}
                                        </Badge>
                                    ) : (
                                        'Sem vencimento'
                                    )}
                                </Td>
                            </Tr>
                        ))}
                    </tbody>
                </Table>
                {member.user.externalCertifications.length === 0 && (
                    <EmptyState>Nenhuma certificação externa registrada ainda.</EmptyState>
                )}
            </TableWrapper>

            <Form onSubmit={handleSubmit((data) => addMutation.mutate(data))} style={{ marginTop: '1rem', borderTop: '1px solid #e9ecef', paddingTop: '1rem' }}>
                <FieldRow>
                    <Field>
                        <Label htmlFor="name">Certificação</Label>
                        <Input id="name" placeholder="ex: Bombeiro Civil, Brigadista Intermediário" {...register('name', { required: true })} />
                        {errors.name && <ErrorText>Informe o nome da certificação.</ErrorText>}
                    </Field>
                    <Field>
                        <Label htmlFor="issuingOrg">Órgão emissor</Label>
                        <Input id="issuingOrg" {...register('issuingOrg')} />
                    </Field>
                </FieldRow>

                <FieldRow>
                    <Field>
                        <Label htmlFor="issuedAt">Emitida em</Label>
                        <Input id="issuedAt" type="date" {...register('issuedAt')} />
                    </Field>
                    <Field>
                        <Label htmlFor="expiresAt">Validade</Label>
                        <Input id="expiresAt" type="date" {...register('expiresAt')} />
                    </Field>
                </FieldRow>

                <Field>
                    <Label htmlFor="proofFile">Comprovante (opcional)</Label>
                    <input id="proofFile" type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                    <HelpText>Envie o certificado/diploma em PDF ou imagem, se disponível.</HelpText>
                </Field>

                <FormActions>
                    <Button type="button" $variant="secondary" onClick={onClose}>Fechar</Button>
                    <Button type="submit" disabled={addMutation.isPending}>
                        {isUploading ? 'Enviando arquivo...' : addMutation.isPending ? 'Salvando...' : 'Adicionar certificação'}
                    </Button>
                </FormActions>
            </Form>
        </Modal>
    );
}

export default function Staff() {
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedUserId, setSelectedUserId] = useState('');
    const [certifyingMember, setCertifyingMember] = useState<StaffMember | null>(null);
    const queryClient = useQueryClient();
    const { user } = useAuth();
    // Esta página já exige `staff:manage` (PermissionRoute), mas escolher quem promover
    // precisa da lista de pessoas, que é `people:manage` — um cargo com só
    // `staff:manage` chegaria aqui e levaria um 403 (e o toast do interceptor global)
    // ao carregar.
    const canListPeople = hasPermission(user, 'people:manage');

    const { data: staff, isLoading } = useQuery({ queryKey: ['staff'], queryFn: () => staffApi.list() });
    const { data: peopleData } = useQuery({ queryKey: ['people', {}], queryFn: () => peopleApi.list(), enabled: canListPeople });

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

    // Mantém o modal de certificações em sincronia com a lista depois de um invalidate
    // (ex: acabou de adicionar uma certificação) em vez de ficar com os dados antigos.
    const certifyingMemberFresh = certifyingMember
        ? (staff ?? []).find((m) => m.id === certifyingMember.id) ?? certifyingMember
        : null;

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
                            <Th>Certificações</Th>
                            <Th>Status</Th>
                            <Th></Th>
                        </tr>
                    </Thead>
                    <tbody>
                        {(staff ?? []).map((member) => {
                            const hasExpired = member.user.externalCertifications.some((c) => isExpired(c.expiresAt));
                            return (
                                <Tr key={member.id}>
                                    <Td>{member.user.name}</Td>
                                    <Td>{member.user.email}</Td>
                                    <Td>{member._count.designations}</Td>
                                    <Td>
                                        <Button $variant="ghost" onClick={() => setCertifyingMember(member)}>
                                            <Award size={14} /> {member.user.externalCertifications.length}
                                            {hasExpired && <Badge $tone="danger">vencida</Badge>}
                                        </Button>
                                    </Td>
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
                            );
                        })}
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

            {certifyingMemberFresh && (
                <CertificationsModal member={certifyingMemberFresh} onClose={() => setCertifyingMember(null)} />
            )}
        </PageLayout>
    );
}
