// frontend/src/pages/Students.tsx
//
// Gestão de alunos da organização ativa. "Aluno" aqui é um `User` com
// `StudentProfile` (decisão 8 do docs/decisoes.md) — por isso o formulário de
// criação já pede e-mail/senha (a pessoa passa a ter login no sistema, não é
// só um cadastro passivo). E-mail/senha não são editáveis depois (fora do
// escopo de `UpdatePersonInput`), por isso o formulário de edição esconde
// esses dois campos e mostra em troca o status ativo/inativo.

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

// Dois schemas em vez de um só: e-mail/senha só existem na criação (não dá
// pra editar depois via UpdatePersonInput), isActive só existe na edição —
// mesmo padrão de admin/Organizations.tsx.
const baseFields = {
    name: z.string().min(1, 'Informe o nome do aluno'),
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
    password: z
        .string()
        .min(8, 'A senha deve ter no mínimo 8 caracteres')
        .regex(/[A-Za-z]/, 'A senha deve conter ao menos uma letra')
        .regex(/[0-9]/, 'A senha deve conter ao menos um número'),
});

const editSchema = z.object({
    ...baseFields,
    isActive: z.boolean().optional(),
});

type FormData = z.infer<typeof createSchema> & Partial<z.infer<typeof editSchema>>;

const blankForm = {
    name: '',
    email: '',
    password: '',
    phone: '',
    birthDate: '',
    guardianName: '',
    guardianPhone: '',
    baptismDate: '',
    pioneerStatus: '' as const,
    signedPetitions: '',
    profession: '',
};

export default function Students() {
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<OrgPerson | null>(null);
    const queryClient = useQueryClient();

    const { data, isLoading } = useQuery({
        queryKey: ['people', { hasStudentProfile: true }],
        queryFn: () => peopleApi.list({ hasStudentProfile: true }),
    });

    const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
        resolver: (editing ? zodResolver(editSchema) : zodResolver(createSchema)) as Resolver<FormData>,
    });

    const openCreate = () => {
        setEditing(null);
        reset(blankForm);
        setModalOpen(true);
    };

    const openEdit = (student: OrgPerson) => {
        setEditing(student);
        const profile = student.studentProfile;
        reset({
            ...blankForm,
            name: student.name,
            phone: student.phone || '',
            birthDate: profile?.birthDate?.slice(0, 10) || '',
            guardianName: profile?.guardianName || '',
            guardianPhone: profile?.guardianPhone || '',
            baptismDate: profile?.baptismDate?.slice(0, 10) || '',
            pioneerStatus: profile?.pioneerStatus || '',
            signedPetitions: profile?.signedPetitions?.join(', ') || '',
            profession: profile?.profession || '',
            isActive: student.isActive,
        });
        setModalOpen(true);
    };

    const saveMutation = useMutation({
        mutationFn: (input: CreatePersonInput | UpdatePersonInput) =>
            editing ? peopleApi.update(editing.id, input as UpdatePersonInput) : peopleApi.create(input as CreatePersonInput),
        onSuccess: () => {
            toast.success(editing ? 'Aluno atualizado com sucesso.' : 'Aluno cadastrado com sucesso.');
            queryClient.invalidateQueries({ queryKey: ['people'] });
            setModalOpen(false);
        },
        onError: (error: any) => {
            toast.error(error?.response?.data?.message || 'Não foi possível salvar o aluno.');
        },
    });

    const onSubmit = (formData: FormData) => {
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

        if (editing) {
            saveMutation.mutate({
                name: formData.name,
                phone: formData.phone || undefined,
                isActive: formData.isActive,
                studentProfile,
            });
        } else {
            saveMutation.mutate({
                name: formData.name,
                email: formData.email!,
                password: formData.password!,
                phone: formData.phone || undefined,
                studentProfile,
            });
        }
    };

    const students = data?.data ?? [];

    return (
        <PageLayout
            title="Alunos"
            subtitle="Cadastro e histórico de matrículas"
            icon={<Users size={16} />}
            actions={
                <Button onClick={openCreate}>
                    <Plus size={16} /> Novo aluno
                </Button>
            }
        >
            <TableWrapper>
                <Table>
                    <Thead>
                        <tr>
                            <Th>Nome</Th>
                            <Th>E-mail</Th>
                            <Th>Telefone</Th>
                            <Th>Responsável</Th>
                            <Th>Status</Th>
                            <Th></Th>
                        </tr>
                    </Thead>
                    <tbody>
                        {students.map((student: OrgPerson) => (
                            <Tr key={student.id}>
                                <Td>{student.name}</Td>
                                <Td>{student.email}</Td>
                                <Td>{student.phone || '—'}</Td>
                                <Td>{student.studentProfile?.guardianName || '—'}</Td>
                                <Td>
                                    <Badge $tone={student.isActive ? 'success' : 'neutral'}>
                                        {student.isActive ? 'Ativo' : 'Inativo'}
                                    </Badge>
                                </Td>
                                <Td>
                                    <Button $variant="ghost" onClick={() => openEdit(student)}>
                                        Editar
                                    </Button>
                                </Td>
                            </Tr>
                        ))}
                    </tbody>
                </Table>
                {!isLoading && students.length === 0 && (
                    <EmptyState>Nenhum aluno cadastrado ainda.</EmptyState>
                )}
            </TableWrapper>

            <Modal open={modalOpen} onOpenChange={setModalOpen} title={editing ? 'Editar aluno' : 'Novo aluno'} width="560px">
                <Form onSubmit={handleSubmit(onSubmit)}>
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
                            <FieldRow>
                                <Field>
                                    <Label htmlFor="email">E-mail</Label>
                                    <Input id="email" type="email" {...register('email')} />
                                    {errors.email && <ErrorText>{errors.email.message}</ErrorText>}
                                </Field>
                                <Field>
                                    <Label htmlFor="password">Senha inicial</Label>
                                    <Input id="password" type="password" {...register('password')} />
                                    {errors.password && <ErrorText>{errors.password.message}</ErrorText>}
                                </Field>
                            </FieldRow>
                            <HelpText>O aluno poderá trocar a senha depois de fazer o primeiro login.</HelpText>
                        </>
                    )}

                    {editing && (
                        <CheckboxField>
                            <input type="checkbox" {...register('isActive')} />
                            Aluno ativo
                        </CheckboxField>
                    )}

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

                    <FormActions>
                        <Button type="button" $variant="secondary" onClick={() => setModalOpen(false)}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={saveMutation.isPending}>
                            {saveMutation.isPending ? 'Salvando...' : editing ? 'Salvar alterações' : 'Cadastrar aluno'}
                        </Button>
                    </FormActions>
                </Form>
            </Modal>
        </PageLayout>
    );
}
