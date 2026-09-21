// frontend/src/pages/People.tsx
//
// Gestão de pessoas da organização ativa — hub único pra todo mundo cadastrado
// (aluno, instrutor, equipe, admin ou só um cadastro sem papel ainda), no
// lugar da antiga tela "Alunos" (que só listava quem tinha `StudentProfile`).
// "Pessoa" aqui é um `User` (decisão 8 do docs/decisoes.md) — por isso o
// formulário de criação já pede e-mail (a pessoa passa a ter login no
// sistema, não é só um cadastro passivo). A senha não é definida aqui: o
// backend gera uma senha aleatória e manda um e-mail de boas-vindas com link
// de ativação (mesmo padrão do admin de academia).
//
// Esta é a ÚNICA tela de cadastro de pessoa nova no sistema — não existe
// "Novo instrutor"/"Novo integrante da equipe" separado. Por isso o
// formulário de criação tem o campo "Tipo de cadastro": ao escolher "Só
// cadastro (instrutor/equipe)", os campos de perfil de aluno somem e a
// pessoa é criada sem `StudentProfile`.
//
// A edição aqui é só de dados básicos (nome/telefone/status) — atribuir
// cargo continua em "Cargos" e promover a staff continua em "Equipe", de
// propósito, pra não duplicar lógica que já existe nessas telas.

import { useState } from 'react';
import { Users, Plus } from 'lucide-react';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageLayout } from '@/components/layout/PageLayout';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Field, Label, Input, Select, ErrorText, CheckboxField, Form, FormActions, FieldRow, HelpText } from '@/components/ui/FormField';
import { Table, TableWrapper, Thead, Tr, Th, Td, EmptyState, Badge } from '@/components/ui/Table';
import { peopleApi, type CreatePersonInput, type UpdatePersonInput } from '@/services/people';
import { toast } from '@/utils/toast';
import type { OrgPerson } from '@/types';

// Dois schemas em vez de um só: e-mail/tipo de cadastro só existem na criação
// (não dá pra editar depois via UpdatePersonInput), isActive só existe na
// edição — mesmo padrão de admin/Organizations.tsx.
const baseFields = {
    name: z.string().min(1, 'Informe o nome'),
    phone: z.string().optional(),
    birthDate: z.string().optional(),
    guardianName: z.string().optional(),
    guardianPhone: z.string().optional(),
    baptismDate: z.string().optional(),
    pioneerStatus: z.enum(['', 'AUXILIARY', 'REGULAR']).optional(),
    signedPetitions: z.string().optional(),
    profession: z.string().optional(),
};

const createSchema = z.object({
    ...baseFields,
    email: z.string().email('Informe um e-mail válido'),
    registrationType: z.enum(['STUDENT', 'PERSON']),
});

const editSchema = z.object({
    ...baseFields,
    isActive: z.boolean().optional(),
});

type FormData = z.infer<typeof createSchema> & Partial<z.infer<typeof editSchema>>;

const blankForm = {
    name: '',
    email: '',
    registrationType: 'STUDENT' as const,
    phone: '',
    birthDate: '',
    guardianName: '',
    guardianPhone: '',
    baptismDate: '',
    pioneerStatus: '' as const,
    signedPetitions: '',
    profession: '',
};

type TypeFilter = 'ALL' | 'STUDENT' | 'INSTRUCTOR' | 'STAFF' | 'NONE';

function personRoleBadges(person: OrgPerson): string[] {
    const roles: string[] = [];
    if (person.role === 'ORG_ADMIN') roles.push('Admin');
    if (person.studentProfile) roles.push('Aluno');
    if (person.instructorAssignments?.length) roles.push('Instrutor');
    if (person.staffMember) roles.push('Equipe');
    if (person.roleAssignments?.[0]) roles.push(person.roleAssignments[0].name);
    return roles;
}

export default function People() {
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<OrgPerson | null>(null);
    const [search, setSearch] = useState('');
    const [typeFilter, setTypeFilter] = useState<TypeFilter>('ALL');
    const queryClient = useQueryClient();

    const { data, isLoading } = useQuery({
        queryKey: ['people', { search }],
        queryFn: () => peopleApi.list({ search: search || undefined }),
    });

    const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<FormData>({
        resolver: (editing ? zodResolver(editSchema) : zodResolver(createSchema)) as Resolver<FormData>,
    });
    const registrationType = watch('registrationType') ?? 'STUDENT';
    const isStudentRegistration = editing !== null ? Boolean(editing.studentProfile) : registrationType === 'STUDENT';

    const openCreate = () => {
        setEditing(null);
        reset(blankForm);
        setModalOpen(true);
    };

    const openEdit = (person: OrgPerson) => {
        setEditing(person);
        const profile = person.studentProfile;
        reset({
            ...blankForm,
            name: person.name,
            phone: person.phone || '',
            birthDate: profile?.birthDate?.slice(0, 10) || '',
            guardianName: profile?.guardianName || '',
            guardianPhone: profile?.guardianPhone || '',
            baptismDate: profile?.baptismDate?.slice(0, 10) || '',
            pioneerStatus: profile?.pioneerStatus || '',
            signedPetitions: profile?.signedPetitions?.join(', ') || '',
            profession: profile?.profession || '',
            isActive: person.isActive,
        });
        setModalOpen(true);
    };

    const saveMutation = useMutation({
        mutationFn: (input: CreatePersonInput | UpdatePersonInput) =>
            editing ? peopleApi.update(editing.id, input as UpdatePersonInput) : peopleApi.create(input as CreatePersonInput),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['people'] });
            setModalOpen(false);
        },
        onError: (error: any) => {
            toast.error(error?.response?.data?.message || 'Não foi possível salvar o cadastro.');
        },
    });

    const resetPasswordMutation = useMutation({
        mutationFn: (id: string) => peopleApi.sendPasswordReset(id),
        onSuccess: () => toast.success('E-mail de redefinição de senha enviado.'),
        onError: (error: any) => {
            toast.error(error?.response?.data?.message || 'Não foi possível enviar o e-mail de redefinição de senha.');
        },
    });

    const handleResetPassword = () => {
        if (!editing) return;
        if (window.confirm(`Enviar um novo e-mail de redefinição de senha para ${editing.name}?`)) {
            resetPasswordMutation.mutate(editing.id);
        }
    };

    const onSubmit = (formData: FormData) => {
        if (editing) {
            // Só reenvia `studentProfile` se a pessoa já era aluna — do
            // contrário, um objeto sempre-truthy (mesmo com campos vazios)
            // faria o backend criar um StudentProfile do nada pra quem não
            // tinha, transformando silenciosamente um instrutor/equipe em
            // "aluno" só por editar nome/telefone.
            const studentProfile = editing.studentProfile
                ? {
                      birthDate: formData.birthDate || undefined,
                      guardianName: formData.guardianName || undefined,
                      guardianPhone: formData.guardianPhone || undefined,
                      baptismDate: formData.baptismDate || undefined,
                      pioneerStatus: formData.pioneerStatus || undefined,
                      profession: formData.profession || undefined,
                      signedPetitions: formData.signedPetitions
                          ? formData.signedPetitions.split(',').map((item) => item.trim()).filter(Boolean)
                          : undefined,
                  }
                : undefined;

            saveMutation.mutate(
                {
                    name: formData.name,
                    phone: formData.phone || undefined,
                    isActive: formData.isActive,
                    studentProfile,
                },
                { onSuccess: () => toast.success('Pessoa atualizada com sucesso.') },
            );
        } else if (formData.registrationType === 'PERSON') {
            saveMutation.mutate(
                {
                    name: formData.name,
                    email: formData.email!,
                    phone: formData.phone || undefined,
                },
                {
                    onSuccess: () =>
                        toast.success(
                            'Pessoa cadastrada com sucesso. Um e-mail de boas-vindas foi enviado. Pra ela virar instrutor ou integrante da equipe, atribua um cargo em "Cargos" ou promova em "Equipe".',
                        ),
                },
            );
        } else {
            const studentProfile = {
                birthDate: formData.birthDate || undefined,
                guardianName: formData.guardianName || undefined,
                guardianPhone: formData.guardianPhone || undefined,
                baptismDate: formData.baptismDate || undefined,
                pioneerStatus: formData.pioneerStatus || undefined,
                profession: formData.profession || undefined,
                signedPetitions: formData.signedPetitions
                    ? formData.signedPetitions.split(',').map((item) => item.trim()).filter(Boolean)
                    : undefined,
            };
            saveMutation.mutate(
                {
                    name: formData.name,
                    email: formData.email!,
                    phone: formData.phone || undefined,
                    studentProfile,
                },
                { onSuccess: () => toast.success('Aluno cadastrado com sucesso. Um e-mail de boas-vindas foi enviado para ele definir a senha.') },
            );
        }
    };

    const people = data?.data ?? [];
    const filteredPeople = people.filter((person) => {
        if (typeFilter === 'ALL') return true;
        if (typeFilter === 'STUDENT') return Boolean(person.studentProfile);
        if (typeFilter === 'INSTRUCTOR') return Boolean(person.instructorAssignments?.length);
        if (typeFilter === 'STAFF') return Boolean(person.staffMember);
        return personRoleBadges(person).length === 0; // NONE
    });

    return (
        <PageLayout
            title="Pessoas"
            subtitle="Cadastro geral de alunos, instrutores e equipe"
            icon={<Users size={16} />}
            actions={
                <Button onClick={openCreate}>
                    <Plus size={16} /> Nova pessoa
                </Button>
            }
        >
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <Field style={{ flex: 1, marginBottom: 0 }}>
                    <Input
                        placeholder="Buscar por nome ou e-mail..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </Field>
                <Field style={{ width: 220, marginBottom: 0 }}>
                    <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}>
                        <option value="ALL">Todos os tipos</option>
                        <option value="STUDENT">Alunos</option>
                        <option value="INSTRUCTOR">Instrutores</option>
                        <option value="STAFF">Equipe</option>
                        <option value="NONE">Sem papel ainda</option>
                    </Select>
                </Field>
            </div>

            <TableWrapper>
                <Table>
                    <Thead>
                        <tr>
                            <Th>Nome</Th>
                            <Th>E-mail</Th>
                            <Th>Telefone</Th>
                            <Th>Papéis</Th>
                            <Th>Status</Th>
                            <Th></Th>
                        </tr>
                    </Thead>
                    <tbody>
                        {filteredPeople.map((person: OrgPerson) => {
                            const roles = personRoleBadges(person);
                            return (
                                <Tr key={person.id}>
                                    <Td>{person.name}</Td>
                                    <Td>{person.email}</Td>
                                    <Td>{person.phone || '—'}</Td>
                                    <Td>
                                        <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                                            {roles.length > 0 ? (
                                                roles.map((role) => (
                                                    <Badge key={role} $tone="info">{role}</Badge>
                                                ))
                                            ) : (
                                                <Badge $tone="neutral">Sem papel</Badge>
                                            )}
                                        </div>
                                    </Td>
                                    <Td>
                                        <Badge $tone={person.isActive ? 'success' : 'neutral'}>
                                            {person.isActive ? 'Ativo' : 'Inativo'}
                                        </Badge>
                                    </Td>
                                    <Td>
                                        <Button $variant="ghost" onClick={() => openEdit(person)}>
                                            Editar
                                        </Button>
                                    </Td>
                                </Tr>
                            );
                        })}
                    </tbody>
                </Table>
                {!isLoading && filteredPeople.length === 0 && (
                    <EmptyState>
                        {people.length === 0 ? 'Nenhuma pessoa cadastrada ainda.' : 'Nenhuma pessoa encontrada com esse filtro.'}
                    </EmptyState>
                )}
            </TableWrapper>

            <Modal open={modalOpen} onOpenChange={setModalOpen} title={editing ? 'Editar pessoa' : 'Nova pessoa'} width="560px">
                <Form onSubmit={handleSubmit(onSubmit)}>
                    {!editing && (
                        <Field>
                            <Label htmlFor="registrationType">Tipo de cadastro</Label>
                            <Select id="registrationType" {...register('registrationType')}>
                                <option value="STUDENT">Aluno</option>
                                <option value="PERSON">Só cadastro (instrutor/equipe)</option>
                            </Select>
                            {registrationType === 'PERSON' && (
                                <HelpText>
                                    Cria a pessoa sem perfil de aluno. Depois, atribua um cargo em "Cargos" ou promova em "Equipe" pra ela virar instrutor ou integrante da equipe.
                                </HelpText>
                            )}
                        </Field>
                    )}

                    <FieldRow>
                        <Field>
                            <Label htmlFor="name">Nome</Label>
                            <Input id="name" {...register('name')} />
                            {errors.name && <ErrorText>{errors.name.message}</ErrorText>}
                        </Field>
                        <Field>
                            <Label htmlFor="phone">Telefone</Label>
                            <Input id="phone" {...register('phone')} />
                        </Field>
                    </FieldRow>

                    {!editing && (
                        <>
                            <Field>
                                <Label htmlFor="email">E-mail</Label>
                                <Input id="email" type="email" {...register('email')} />
                                {errors.email && <ErrorText>{errors.email.message}</ErrorText>}
                            </Field>
                            <HelpText>A pessoa recebe um e-mail de boas-vindas com um link para definir a própria senha.</HelpText>
                        </>
                    )}

                    {editing && (
                        <CheckboxField>
                            <input type="checkbox" {...register('isActive')} />
                            Pessoa ativa
                        </CheckboxField>
                    )}

                    {isStudentRegistration && (
                        <>
                            <FieldRow>
                                <Field>
                                    <Label htmlFor="birthDate">Data de nascimento</Label>
                                    <Input id="birthDate" type="date" {...register('birthDate')} />
                                </Field>
                                <Field>
                                    <Label htmlFor="guardianName">Nome do responsável</Label>
                                    <Input id="guardianName" {...register('guardianName')} />
                                </Field>
                            </FieldRow>

                            <Field>
                                <Label htmlFor="guardianPhone">Telefone do responsável</Label>
                                <Input id="guardianPhone" {...register('guardianPhone')} />
                            </Field>

                            <FieldRow>
                                <Field>
                                    <Label htmlFor="baptismDate">Data de batismo</Label>
                                    <Input id="baptismDate" type="date" {...register('baptismDate')} />
                                </Field>
                                <Field>
                                    <Label htmlFor="pioneerStatus">Pioneiro</Label>
                                    <Select id="pioneerStatus" {...register('pioneerStatus')}>
                                        <option value="">Não é pioneiro</option>
                                        <option value="AUXILIARY">Pioneiro auxiliar</option>
                                        <option value="REGULAR">Pioneiro regular</option>
                                    </Select>
                                </Field>
                            </FieldRow>

                            <Field>
                                <Label htmlFor="profession">Profissão ou área de estudo</Label>
                                <Input id="profession" {...register('profession')} />
                            </Field>

                            <Field>
                                <Label htmlFor="signedPetitions">Petições assinadas</Label>
                                <Input id="signedPetitions" placeholder="Ex: Pioneiro regular, Emissário" {...register('signedPetitions')} />
                                <HelpText>Separe múltiplas petições por vírgula. Deixe em branco se não houver petição assinada.</HelpText>
                            </Field>
                        </>
                    )}

                    {editing && !editing.studentProfile && (
                        <HelpText>
                            Esta pessoa não tem perfil de aluno. Pra matriculá-la numa turma, primeiro adicione um perfil de aluno — funcionalidade
                            ainda não disponível nesta tela.
                        </HelpText>
                    )}

                    <FormActions style={editing ? { justifyContent: 'space-between' } : undefined}>
                        {editing && (
                            <Button
                                type="button"
                                $variant="ghost"
                                onClick={handleResetPassword}
                                disabled={resetPasswordMutation.isPending}
                            >
                                {resetPasswordMutation.isPending ? 'Enviando...' : 'Redefinir senha'}
                            </Button>
                        )}
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <Button type="button" $variant="secondary" onClick={() => setModalOpen(false)}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={saveMutation.isPending}>
                            {saveMutation.isPending
                                ? 'Salvando...'
                                : editing
                                  ? 'Salvar alterações'
                                  : registrationType === 'PERSON'
                                    ? 'Cadastrar pessoa'
                                    : 'Cadastrar aluno'}
                        </Button>
                        </div>
                    </FormActions>
                </Form>
            </Modal>
        </PageLayout>
    );
}
