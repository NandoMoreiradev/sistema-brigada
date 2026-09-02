// frontend/src/pages/Courses.tsx
//
// Lista de turmas da organização ativa. Cada turma é o "detalhe" de um Event
// kind=TURMA (decisão 2 do docs/decisoes.md) — a data/local/status vêm do
// evento, o resto (categoria, vagas, critérios de certificado) da própria
// Course. Detalhe (aulas/matrícula/presença) fica em CourseDetail.tsx.

import { useState } from 'react';
import { GraduationCap, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { PageLayout } from '@/components/layout/PageLayout';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Field, Label, Input, ErrorText, Form, FormActions, FieldRow } from '@/components/ui/FormField';
import { Table, TableWrapper, Thead, Tr, Th, Td, EmptyState, Badge } from '@/components/ui/Table';
import { coursesApi, type CreateCourseInput } from '@/services/courses';
import { peopleApi } from '@/services/people';
import { toast } from '@/utils/toast';
import type { EventStatus } from '@/types';

const schema = z.object({
    title: z.string().min(1, 'Informe o título da turma'),
    location: z.string().optional(),
    startDate: z.string().min(1, 'Informe a data de início'),
    endDate: z.string().optional(),
    category: z.string().optional(),
    vacancies: z.string().optional(),
    instructorUserIds: z.array(z.string()).optional(),
});

type FormData = z.infer<typeof schema>;

const STATUS_LABEL: Record<EventStatus, string> = {
    SCHEDULED: 'Agendada',
    ONGOING: 'Em andamento',
    COMPLETED: 'Concluída',
    CANCELLED: 'Cancelada',
};

const STATUS_TONE: Record<EventStatus, 'neutral' | 'success' | 'info' | 'danger'> = {
    SCHEDULED: 'info',
    ONGOING: 'success',
    COMPLETED: 'neutral',
    CANCELLED: 'danger',
};

export default function Courses() {
    const [modalOpen, setModalOpen] = useState(false);
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const { data, isLoading } = useQuery({ queryKey: ['courses'], queryFn: () => coursesApi.list() });
    const { data: peopleData } = useQuery({ queryKey: ['people', {}], queryFn: () => peopleApi.list() });

    const { register, handleSubmit, reset, control, formState: { errors } } = useForm<FormData>({
        resolver: zodResolver(schema),
        defaultValues: { instructorUserIds: [] },
    });

    const openCreate = () => {
        reset({ title: '', location: '', startDate: '', endDate: '', category: '', vacancies: '', instructorUserIds: [] });
        setModalOpen(true);
    };

    const createMutation = useMutation({
        mutationFn: (input: CreateCourseInput) => coursesApi.create(input),
        onSuccess: (course) => {
            toast.success('Turma criada com sucesso.');
            queryClient.invalidateQueries({ queryKey: ['courses'] });
            setModalOpen(false);
            navigate(`/courses/${course.id}`);
        },
        onError: (error: any) => {
            toast.error(error?.response?.data?.message || 'Não foi possível criar a turma.');
        },
    });

    const onSubmit = (formData: FormData) => {
        createMutation.mutate({
            title: formData.title,
            location: formData.location || undefined,
            startDate: formData.startDate,
            endDate: formData.endDate || undefined,
            category: formData.category || undefined,
            vacancies: formData.vacancies ? Number(formData.vacancies) : undefined,
            instructorUserIds: formData.instructorUserIds,
        });
    };

    const courses = data?.data ?? [];
    const people = peopleData?.data ?? [];

    return (
        <PageLayout
            title="Turmas"
            subtitle="Cursos, aulas e matrículas"
            icon={<GraduationCap size={16} />}
            actions={
                <Button onClick={openCreate}>
                    <Plus size={16} /> Nova turma
                </Button>
            }
        >
            <TableWrapper>
                <Table>
                    <Thead>
                        <tr>
                            <Th>Turma</Th>
                            <Th>Categoria</Th>
                            <Th>Início</Th>
                            <Th>Instrutores</Th>
                            <Th>Matriculados</Th>
                            <Th>Status</Th>
                            <Th></Th>
                        </tr>
                    </Thead>
                    <tbody>
                        {courses.map((course) => (
                            <Tr key={course.id} onClick={() => navigate(`/courses/${course.id}`)} style={{ cursor: 'pointer' }}>
                                <Td>{course.event.title}</Td>
                                <Td>{course.category || '—'}</Td>
                                <Td>{format(new Date(course.event.startDate), 'dd/MM/yyyy')}</Td>
                                <Td>{course.instructors.map((i) => i.user.name).join(', ') || '—'}</Td>
                                <Td>
                                    {course._count.enrollments}
                                    {course.vacancies ? ` / ${course.vacancies}` : ''}
                                </Td>
                                <Td>
                                    <Badge $tone={STATUS_TONE[course.event.status]}>{STATUS_LABEL[course.event.status]}</Badge>
                                </Td>
                                <Td>
                                    <Button $variant="ghost" onClick={(e) => { e.stopPropagation(); navigate(`/courses/${course.id}`); }}>
                                        Abrir
                                    </Button>
                                </Td>
                            </Tr>
                        ))}
                    </tbody>
                </Table>
                {!isLoading && courses.length === 0 && <EmptyState>Nenhuma turma cadastrada ainda.</EmptyState>}
            </TableWrapper>

            <Modal open={modalOpen} onOpenChange={setModalOpen} title="Nova turma" width="560px">
                <Form onSubmit={handleSubmit(onSubmit)}>
                    <Field>
                        <Label htmlFor="title">Título</Label>
                        <Input id="title" placeholder="ex: Brigada de Incêndio — Turma 12" {...register('title')} />
                        {errors.title && <ErrorText>{errors.title.message}</ErrorText>}
                    </Field>

                    <FieldRow>
                        <Field>
                            <Label htmlFor="category">Categoria</Label>
                            <Input id="category" placeholder="ex: Brigada de Incêndio" {...register('category')} />
                        </Field>
                        <Field>
                            <Label htmlFor="vacancies">Vagas</Label>
                            <Input id="vacancies" type="number" min={1} {...register('vacancies')} />
                        </Field>
                    </FieldRow>

                    <FieldRow>
                        <Field>
                            <Label htmlFor="startDate">Data de início</Label>
                            <Input id="startDate" type="date" {...register('startDate')} />
                            {errors.startDate && <ErrorText>{errors.startDate.message}</ErrorText>}
                        </Field>
                        <Field>
                            <Label htmlFor="endDate">Data de término (opcional)</Label>
                            <Input id="endDate" type="date" {...register('endDate')} />
                        </Field>
                    </FieldRow>

                    <Field>
                        <Label htmlFor="location">Local</Label>
                        <Input id="location" {...register('location')} />
                    </Field>

                    <Field>
                        <Label>Instrutores</Label>
                        <Controller
                            control={control}
                            name="instructorUserIds"
                            render={({ field }) => (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', maxHeight: 140, overflowY: 'auto' }}>
                                    {people.map((person) => (
                                        <label key={person.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem' }}>
                                            <input
                                                type="checkbox"
                                                checked={field.value?.includes(person.id) ?? false}
                                                onChange={(e) => {
                                                    const current = field.value ?? [];
                                                    field.onChange(
                                                        e.target.checked
                                                            ? [...current, person.id]
                                                            : current.filter((id) => id !== person.id),
                                                    );
                                                }}
                                            />
                                            {person.name}
                                        </label>
                                    ))}
                                    {people.length === 0 && <span>Nenhuma pessoa cadastrada ainda.</span>}
                                </div>
                            )}
                        />
                    </Field>

                    <FormActions>
                        <Button type="button" $variant="secondary" onClick={() => setModalOpen(false)}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={createMutation.isPending}>
                            {createMutation.isPending ? 'Salvando...' : 'Criar turma'}
                        </Button>
                    </FormActions>
                </Form>
            </Modal>
        </PageLayout>
    );
}
