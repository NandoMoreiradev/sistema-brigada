// frontend/src/pages/Staff.tsx
//
// Equipe de atuação (brigadista/bombeiro). Decisão 8 do docs/decisoes.md:
// staff é um papel adicional sobre um `User` já existente, não um cadastro
// próprio — por isso a tela só "promove" alguém que já está em Alunos/Turmas
// (ou foi cadastrado como pessoa qualquer), em vez de ter um formulário de
// cadastro completo aqui.
//
// Categoria (decisão 78): rótulo opcional de cada membro (Brigadista, Bombeiro Civil...), tirado
// de um catálogo por academia que se edita em "Categorias". Promover aceita várias pessoas de uma
// vez (ex.: uma turma inteira) e já define a categoria delas.
//
// Certificação externa (decisões 10/32): registro manual de uma qualificação
// que a pessoa já trazia de fora (ex: já é Bombeiro Civil ou Brigadista
// Intermediário antes de entrar nesta academia). Presa ao `User`
// (`POST /users/:id/external-certifications`), não ao `StaffMember` — é um
// fato sobre a pessoa, não sobre este papel — por isso o modal abaixo lê e
// grava via `peopleApi`, e só usa o `member.user.id` daqui.

import { useMemo, useState } from 'react';
import styled from 'styled-components';
import { ShieldCheck, Plus, Award, Tags, Pencil, Trash2, Check } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageLayout } from '@/components/layout/PageLayout';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Field, Label, Input, Select, Form, FormActions, ErrorText, FieldRow, HelpText, CheckboxField } from '@/components/ui/FormField';
import { PillSelect } from '@/components/ui/PillSelect';
import { Table, TableWrapper, Thead, Tr, Th, Td, EmptyState, Badge } from '@/components/ui/Table';
import { staffApi, type StaffCategory, type StaffMember } from '@/services/staff';
import { peopleApi } from '@/services/people';
import { mediaApi } from '@/services/media';
import { toast } from '@/utils/toast';
import { useAuth } from '@/contexts/AuthContext';
import { hasPermission } from '@/utils/permissions';
import { apiErrorMessage } from '@/utils/apiError';

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

const CheckList = styled.div`
    max-height: 260px;
    overflow-y: auto;
    border: 1px solid ${({ theme }) => theme.colors.borderLight};
    border-radius: ${({ theme }) => theme.radii.sm};
    padding: 0.5rem 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    font-size: 0.8125rem;
`;

const LinkButton = styled.button`
    background: none;
    border: none;
    color: ${({ theme }) => theme.colors.primary};
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
    padding: 0;
`;

const CategoryRow = styled.div`
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.4rem 0;
    border-bottom: 1px solid ${({ theme }) => theme.colors.borderLight};
`;

const NO_CATEGORY = '__none__';

function PromoteModal({ open, onOpenChange, categories, staffUserIds }: { open: boolean; onOpenChange: (open: boolean) => void; categories: StaffCategory[]; staffUserIds: Set<string> }) {
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const [search, setSearch] = useState('');
    const [onlyStudents, setOnlyStudents] = useState(false);
    const [selected, setSelected] = useState<string[]>([]);
    const [categoryId, setCategoryId] = useState('');

    // Esta página exige `staff:manage`, mas a lista de pessoas é `people:manage` — um cargo só com a
    // primeira abriria o modal e levaria um 403 ao carregar.
    const canListPeople = hasPermission(user, 'people:manage');
    const { data: peopleData, isLoading } = useQuery({
        queryKey: ['people', 'promote', { search, onlyStudents }],
        queryFn: () => peopleApi.list({ search: search.trim() || undefined, hasStudentProfile: onlyStudents || undefined }),
        enabled: open && canListPeople,
    });
    const eligible = (peopleData?.data ?? []).filter((p) => !staffUserIds.has(p.id));

    const reset = () => { setSearch(''); setOnlyStudents(false); setSelected([]); setCategoryId(''); };

    const promoteMutation = useMutation({
        mutationFn: () => staffApi.promoteMany(selected, categoryId || undefined),
        onSuccess: ({ promoted, skipped }) => {
            toast.success(skipped > 0 ? `${promoted} pessoa(s) promovida(s); ${skipped} já estavam na equipe.` : `${promoted} pessoa(s) adicionada(s) à equipe.`);
            queryClient.invalidateQueries({ queryKey: ['staff'] });
            queryClient.invalidateQueries({ queryKey: ['people'] });
            reset();
            onOpenChange(false);
        },
        onError: (error: unknown) => toast.error(apiErrorMessage(error, 'Não foi possível promover as pessoas selecionadas.')),
    });

    const toggle = (id: string) => setSelected((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]));
    const allVisibleSelected = eligible.length > 0 && eligible.every((p) => selected.includes(p.id));
    const toggleVisible = () =>
        setSelected((current) => (allVisibleSelected ? current.filter((id) => !eligible.some((p) => p.id === id)) : [...new Set([...current, ...eligible.map((p) => p.id)])]));

    return (
        <Modal open={open} onOpenChange={(next) => { if (!next) reset(); onOpenChange(next); }} title="Promover para equipe de atuação" width="560px">
            <Form onSubmit={(e) => { e.preventDefault(); if (selected.length > 0) promoteMutation.mutate(); }}>
                <Field>
                    <Label htmlFor="promote-category">Categoria (opcional)</Label>
                    <Select id="promote-category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                        <option value="">Sem categoria</option>
                        {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </Select>
                    <HelpText>Vale para todas as pessoas selecionadas. Dá para mudar depois, uma a uma.</HelpText>
                </Field>

                <Field>
                    <Label htmlFor="promote-search">Pessoas ({selected.length} selecionada{selected.length === 1 ? '' : 's'})</Label>
                    <Input id="promote-search" placeholder="Buscar por nome ou e-mail" value={search} onChange={(e) => setSearch(e.target.value)} disabled={!canListPeople} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', margin: '0.35rem 0' }}>
                        <CheckboxField style={{ fontWeight: 500 }}>
                            <input type="checkbox" checked={onlyStudents} onChange={(e) => setOnlyStudents(e.target.checked)} />
                            Só alunos
                        </CheckboxField>
                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                            <LinkButton type="button" disabled={eligible.length === 0} onClick={toggleVisible}>
                                {allVisibleSelected ? 'Desmarcar a lista' : 'Selecionar a lista'}
                            </LinkButton>
                            <LinkButton type="button" onClick={() => setSelected([])}>Limpar</LinkButton>
                        </div>
                    </div>
                    <CheckList>
                        {eligible.map((person) => (
                            <label key={person.id} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                                <input type="checkbox" checked={selected.includes(person.id)} onChange={() => toggle(person.id)} />
                                {person.name} <span style={{ color: '#6c757d' }}>— {person.email}</span>
                            </label>
                        ))}
                        {!isLoading && eligible.length === 0 && (
                            <span>{canListPeople ? 'Ninguém para promover com esse filtro: quem já está na equipe não aparece aqui.' : 'Seu acesso não permite listar pessoas (precisa da permissão de gerenciar pessoas).'}</span>
                        )}
                    </CheckList>
                    <HelpText>Mostra até 100 pessoas por vez: use a busca para chegar às demais. As seleções são mantidas ao buscar.</HelpText>
                </Field>

                <FormActions>
                    <Button type="button" $variant="secondary" onClick={() => onOpenChange(false)}>Cancelar</Button>
                    <Button type="submit" disabled={selected.length === 0 || promoteMutation.isPending}>
                        {promoteMutation.isPending ? 'Salvando...' : selected.length > 0 ? `Promover ${selected.length}` : 'Promover'}
                    </Button>
                </FormActions>
            </Form>
        </Modal>
    );
}

function CategoriesModal({ open, onOpenChange, categories }: { open: boolean; onOpenChange: (open: boolean) => void; categories: StaffCategory[] }) {
    const queryClient = useQueryClient();
    const [newName, setNewName] = useState('');
    const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);

    const done = (message: string) => {
        toast.success(message);
        queryClient.invalidateQueries({ queryKey: ['staff'] });
        queryClient.invalidateQueries({ queryKey: ['people'] });
    };

    const createMutation = useMutation({
        mutationFn: () => staffApi.categories.create(newName.trim()),
        onSuccess: () => { setNewName(''); done('Categoria criada.'); },
        onError: (error: unknown) => toast.error(apiErrorMessage(error, 'Não foi possível criar a categoria.')),
    });
    const renameMutation = useMutation({
        mutationFn: ({ id, name }: { id: string; name: string }) => staffApi.categories.rename(id, name.trim()),
        onSuccess: () => { setEditing(null); done('Categoria renomeada.'); },
        onError: (error: unknown) => toast.error(apiErrorMessage(error, 'Não foi possível renomear a categoria.')),
    });
    const removeMutation = useMutation({
        mutationFn: (id: string) => staffApi.categories.remove(id),
        onSuccess: () => done('Categoria excluída.'),
        onError: (error: unknown) => toast.error(apiErrorMessage(error, 'Não foi possível excluir a categoria.')),
    });

    return (
        <Modal open={open} onOpenChange={onOpenChange} title="Categorias da equipe" width="520px">
            <HelpText>Use para diferenciar quem é brigadista, bombeiro civil, coordenador etc. Cada pessoa da equipe pode ter uma categoria.</HelpText>
            <div style={{ margin: '0.75rem 0' }}>
                {categories.map((category) => {
                    const members = category._count?.members ?? 0;
                    return (
                        <CategoryRow key={category.id}>
                            {editing?.id === category.id ? (
                                <>
                                    <Input aria-label="Novo nome da categoria" autoFocus value={editing.name} maxLength={60} onChange={(e) => setEditing({ id: category.id, name: e.target.value })} style={{ flex: 1 }} />
                                    <Button type="button" $variant="ghost" aria-label="Salvar nome" disabled={!editing.name.trim() || renameMutation.isPending} onClick={() => renameMutation.mutate(editing)}><Check size={14} /></Button>
                                </>
                            ) : (
                                <>
                                    <span style={{ flex: 1 }}><strong>{category.name}</strong> <span style={{ color: '#6c757d', fontSize: '0.75rem' }}>{members} pessoa{members === 1 ? '' : 's'}</span></span>
                                    <Button type="button" $variant="ghost" aria-label={`Renomear ${category.name}`} onClick={() => setEditing({ id: category.id, name: category.name })}><Pencil size={14} /></Button>
                                    <Button
                                        type="button"
                                        $variant="ghost"
                                        aria-label={`Excluir ${category.name}`}
                                        title={members > 0 ? 'Mude a categoria das pessoas antes de excluir' : 'Excluir categoria'}
                                        disabled={members > 0 || removeMutation.isPending}
                                        onClick={() => { if (window.confirm(`Excluir a categoria "${category.name}"?`)) removeMutation.mutate(category.id); }}
                                    >
                                        <Trash2 size={14} />
                                    </Button>
                                </>
                            )}
                        </CategoryRow>
                    );
                })}
                {categories.length === 0 && <HelpText>Nenhuma categoria criada ainda.</HelpText>}
            </div>
            <Form onSubmit={(e) => { e.preventDefault(); if (newName.trim()) createMutation.mutate(); }}>
                <Field>
                    <Label htmlFor="new-category">Nova categoria</Label>
                    <Input id="new-category" placeholder="ex: Socorrista" maxLength={60} value={newName} onChange={(e) => setNewName(e.target.value)} />
                </Field>
                <FormActions>
                    <Button type="button" $variant="secondary" onClick={() => onOpenChange(false)}>Fechar</Button>
                    <Button type="submit" disabled={!newName.trim() || createMutation.isPending}><Plus size={14} /> Adicionar</Button>
                </FormActions>
            </Form>
        </Modal>
    );
}

export default function Staff() {
    const [promoteOpen, setPromoteOpen] = useState(false);
    const [categoriesOpen, setCategoriesOpen] = useState(false);
    const [categoryFilter, setCategoryFilter] = useState('');
    const [certifyingMember, setCertifyingMember] = useState<StaffMember | null>(null);
    const queryClient = useQueryClient();

    const { data: staff, isLoading } = useQuery({ queryKey: ['staff'], queryFn: () => staffApi.list() });
    const { data: categoriesData } = useQuery({ queryKey: ['staff', 'categories'], queryFn: () => staffApi.categories.list() });
    const categories = categoriesData ?? [];

    const statusMutation = useMutation({
        mutationFn: ({ id, status }: { id: string; status: 'ACTIVE' | 'INACTIVE' }) => staffApi.updateStatus(id, status),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['staff'] });
            toast.success('Status atualizado.');
        },
        onError: (error: any) => toast.error(error?.response?.data?.message || 'Não foi possível atualizar o status.'),
    });

    const categoryMutation = useMutation({
        mutationFn: ({ id, categoryId }: { id: string; categoryId: string | null }) => staffApi.setCategory(id, categoryId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['staff'] });
            queryClient.invalidateQueries({ queryKey: ['people'] });
        },
        onError: (error: unknown) => toast.error(apiErrorMessage(error, 'Não foi possível mudar a categoria.')),
    });

    const staffUserIds = useMemo(() => new Set((staff ?? []).map((s) => s.user.id)), [staff]);
    const listed = (staff ?? []).filter((member) => {
        if (!categoryFilter) return true;
        if (categoryFilter === NO_CATEGORY) return member.category === null;
        return member.category?.id === categoryFilter;
    });

    // Mantém o modal de certificações em sincronia com a lista depois de um invalidate
    // (ex: acabou de adicionar uma certificação) em vez de ficar com os dados antigos.
    const certifyingMemberFresh = certifyingMember
        ? (staff ?? []).find((m) => m.id === certifyingMember.id) ?? certifyingMember
        : null;

    return (
        <PageLayout
            title="Equipe"
            subtitle="Brigadistas, bombeiros e coordenadores disponíveis para designação"
            icon={<ShieldCheck size={16} />}
            actions={
                <>
                    <Button $variant="secondary" onClick={() => setCategoriesOpen(true)}>
                        <Tags size={16} /> Categorias
                    </Button>
                    <Button onClick={() => setPromoteOpen(true)}>
                        <Plus size={16} /> Promover para equipe
                    </Button>
                </>
            }
        >
            {(staff ?? []).length > 0 && (
                <div style={{ marginBottom: '0.75rem', maxWidth: 260 }}>
                    <Select aria-label="Filtrar por categoria" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                        <option value="">Todas as categorias</option>
                        {categories.map((c) => <option key={c.id} value={c.id}>{c.name} ({c._count?.members ?? 0})</option>)}
                        <option value={NO_CATEGORY}>Sem categoria ({(staff ?? []).filter((m) => m.category === null).length})</option>
                    </Select>
                </div>
            )}
            <TableWrapper>
                <Table>
                    <Thead>
                        <tr>
                            <Th>Nome</Th>
                            <Th>E-mail</Th>
                            <Th>Categoria</Th>
                            <Th>Designações</Th>
                            <Th>Certificações</Th>
                            <Th>Status</Th>
                            <Th></Th>
                        </tr>
                    </Thead>
                    <tbody>
                        {listed.map((member) => {
                            const hasExpired = member.user.externalCertifications.some((c) => isExpired(c.expiresAt));
                            return (
                                <Tr key={member.id}>
                                    <Td>{member.user.name}</Td>
                                    <Td>{member.user.email}</Td>
                                    <Td>
                                        <PillSelect
                                            $tone={member.category ? 'info' : 'neutral'}
                                            aria-label={`Categoria de ${member.user.name}`}
                                            value={member.category?.id ?? ''}
                                            disabled={categoryMutation.isPending}
                                            onChange={(e) => categoryMutation.mutate({ id: member.id, categoryId: e.target.value || null })}
                                        >
                                            <option value="">Sem categoria</option>
                                            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                                        </PillSelect>
                                    </Td>
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
                {!isLoading && (staff ?? []).length > 0 && listed.length === 0 && <EmptyState>Ninguém nessa categoria.</EmptyState>}
            </TableWrapper>

            <PromoteModal open={promoteOpen} onOpenChange={setPromoteOpen} categories={categories} staffUserIds={staffUserIds} />
            <CategoriesModal open={categoriesOpen} onOpenChange={setCategoriesOpen} categories={categories} />

            {certifyingMemberFresh && (
                <CertificationsModal member={certifyingMemberFresh} onClose={() => setCertifyingMember(null)} />
            )}
        </PageLayout>
    );
}
