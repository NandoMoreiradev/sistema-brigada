// frontend/src/pages/Students.tsx
//
// Gestão de alunos da organização ativa. "Aluno" aqui é um `User` com
// `StudentProfile` (decisão 8 do docs/decisoes.md) — por isso o formulário de
// criação já pede e-mail/senha (a pessoa passa a ter login no sistema, não é
// só um cadastro passivo).

import { useState } from 'react';
import { Users, Plus } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageLayout } from '@/components/layout/PageLayout';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Field, Label, Input, ErrorText, Form, FormActions, FieldRow, HelpText } from '@/components/ui/FormField';
import { Table, TableWrapper, Thead, Tr, Th, Td, EmptyState, Badge } from '@/components/ui/Table';
import { peopleApi, type CreatePersonInput } from '@/services/people';
import { toast } from '@/utils/toast';
import type { OrgPerson } from '@/types';

const createSchema = z.object({
    name: z.string().min(1, 'Informe o nome do aluno'),
    email: z.string().email('Informe um e-mail válido'),
    password: z
        .string()
        .min(8, 'A senha deve ter no mínimo 8 caracteres')
        .regex(/[A-Za-z]/, 'A senha deve conter ao menos uma letra')
        .regex(/[0-9]/, 'A senha deve conter ao menos um número'),
    phone: z.string().optional(),
    birthDate: z.string().optional(),
    guardianName: z.string().optional(),
    guardianPhone: z.string().optional(),
});

type FormData = z.infer<typeof createSchema>;

export default function Students() {
    const [modalOpen, setModalOpen] = useState(false);
    const queryClient = useQueryClient();

    const { data, isLoading } = useQuery({
        queryKey: ['people', { hasStudentProfile: true }],
        queryFn: () => peopleApi.list({ hasStudentProfile: true }),
    });

    const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
        resolver: zodResolver(createSchema),
    });

    const openCreate = () => {
        reset({ name: '', email: '', password: '', phone: '', birthDate: '', guardianName: '', guardianPhone: '' });
        setModalOpen(true);
    };

    const createMutation = useMutation({
        mutationFn: (input: CreatePersonInput) => peopleApi.create(input),
        onSuccess: () => {
            toast.success('Aluno cadastrado com sucesso.');
            queryClient.invalidateQueries({ queryKey: ['people'] });
            setModalOpen(false);
        },
        onError: (error: any) => {
            toast.error(error?.response?.data?.message || 'Não foi possível cadastrar o aluno.');
        },
    });

    const onSubmit = (formData: FormData) => {
        createMutation.mutate({
            name: formData.name,
            email: formData.email,
            password: formData.password,
            phone: formData.phone || undefined,
            studentProfile: {
                birthDate: formData.birthDate || undefined,
                guardianName: formData.guardianName || undefined,
                guardianPhone: formData.guardianPhone || undefined,
            },
        });
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
                            </Tr>
                        ))}
                    </tbody>
                </Table>
                {!isLoading && students.length === 0 && (
                    <EmptyState>Nenhum aluno cadastrado ainda.</EmptyState>
                )}
            </TableWrapper>

            <Modal open={modalOpen} onOpenChange={setModalOpen} title="Novo aluno" width="560px">
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

                    <FormActions>
                        <Button type="button" $variant="secondary" onClick={() => setModalOpen(false)}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={createMutation.isPending}>
                            {createMutation.isPending ? 'Salvando...' : 'Cadastrar aluno'}
                        </Button>
                    </FormActions>
                </Form>
            </Modal>
        </PageLayout>
    );
}
