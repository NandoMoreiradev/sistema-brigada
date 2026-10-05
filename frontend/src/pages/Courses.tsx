// frontend/src/pages/Courses.tsx
//
// Lista de turmas da organização ativa. Cada turma é o "detalhe" de um Event
// kind=TURMA (decisão 2 do docs/decisoes.md) — a data/local/status vêm do
// evento, o resto (categoria, vagas, critérios de certificado) da própria
// Course. Detalhe (aulas/matrícula/presença) fica em CourseDetail.tsx.

import { useState } from 'react';
import { GraduationCap, Plus, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageLayout } from '@/components/layout/PageLayout';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { TrashButton } from '@/components/trash/TrashModal';
import { Field, Label, Input, Select, Textarea, ErrorText, Form, FormActions, FieldRow, CheckboxField } from '@/components/ui/FormField';
import { Table, TableWrapper, Thead, Tr, Th, Td, EmptyState, Badge } from '@/components/ui/Table';
import { coursesApi, type CreateCourseInput } from '@/services/courses';
import { peopleApi } from '@/services/people';
import { toast } from '@/utils/toast';
import { apiErrorMessage } from '@/utils/apiError';
import { formatDateOnly } from '@/utils/courseDates';
import { RoomSelect } from '@/pages/course-detail/RoomSelect';
import { ScrollX, Toolbar, ToolbarGroup, SearchInput, FilterChip, MiniProgress, Muted } from '@/pages/course-detail/styles';
import type { EventStatus } from '@/types';

const schema = z.object({
    title: z.string().min(1, 'Informe o título da turma'),
    location: z.string().optional(),
    defaultRoomId: z.string().optional(),
    startDate: z.string().min(1, 'Informe a data de início'),
    endDate: z.string().optional(),
    category: z.string().optional(),
    vacancies: z.string().optional(),
    minAttendancePercent: z.string().optional(),
    requireAllLessonsWatched: z.boolean().optional(),
    recyclingValidityMonths: z.string().optional(),
    recommendedRecyclingCourseId: z.string().optional(),
    syllabus: z.string().optional(),
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
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<EventStatus | 'ALL'>('ALL');
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const { data, isLoading } = useQuery({ queryKey: ['courses'], queryFn: () => coursesApi.list() });
    // Lista enxuta (id + nome), aberta a qualquer usuário da escola: escolher instrutor ao criar a
    // turma não exige acesso ao cadastro de pessoas (`people:manage`).
    const { data: roster } = useQuery({ queryKey: ['people', 'roster'], queryFn: () => peopleApi.roster() });

    const { register, handleSubmit, reset, control, watch, formState: { errors } } = useForm<FormData>({
        resolver: zodResolver(schema),
        defaultValues: { instructorUserIds: [] },
    });

    const openCreate = () => {
        reset({
            title: '',
            location: '',
            defaultRoomId: '',
            startDate: '',
            endDate: '',
            category: '',
            vacancies: '',
            minAttendancePercent: '75',
            requireAllLessonsWatched: true,
            recyclingValidityMonths: '',
            recommendedRecyclingCourseId: '',
            syllabus: '',
            instructorUserIds: [],
        });
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
        onError: (error: unknown) => {
            toast.error(apiErrorMessage(error, 'Não foi possível criar a turma.'));
        },
    });

    const onSubmit = (formData: FormData) => {
        createMutation.mutate({
            title: formData.title,
            location: formData.location || undefined,
            defaultRoomId: formData.defaultRoomId || undefined,
            startDate: formData.startDate,
            endDate: formData.endDate || undefined,
            category: formData.category || undefined,
            vacancies: formData.vacancies ? Number(formData.vacancies) : undefined,
            minAttendancePercent: formData.minAttendancePercent ? Number(formData.minAttendancePercent) : undefined,
            requireAllLessonsWatched: formData.requireAllLessonsWatched,
            recyclingValidityMonths: formData.recyclingValidityMonths ? Number(formData.recyclingValidityMonths) : undefined,
            recommendedRecyclingCourseId: formData.recommendedRecyclingCourseId || undefined,
            syllabus: formData.syllabus || undefined,
            instructorUserIds: formData.instructorUserIds,
        });
    };

    const courses = data?.data ?? [];
    const normalize = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const visibleCourses = courses.filter((course) => {
        if (statusFilter !== 'ALL' && course.event.status !== statusFilter) return false;
        if (!search.trim()) return true;
        const haystack = normalize(`${course.event.title} ${course.category ?? ''} ${course.instructors.map((i) => i.user.name).join(' ')}`);
        return haystack.includes(normalize(search));
    });
    const statusCounts = courses.reduce<Record<string, number>>((acc, course) => ({ ...acc, [course.event.status]: (acc[course.event.status] ?? 0) + 1 }), {});
    const people = roster ?? [];

    return (
        <PageLayout
            title="Turmas"
            subtitle="Cursos, aulas e matrículas"
            icon={<GraduationCap size={16} />}
            actions={
                <>
                    <TrashButton entity="courses" />
                    <Button onClick={openCreate}>
                        <Plus size={16} /> Nova turma
                    </Button>
                </>
            }
        >
            <Toolbar>
                <ToolbarGroup>
                    <div style={{ position: 'relative' }}>
                        <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#6c757d' }} />
                        <SearchInput
                            type="search"
                            placeholder="Buscar turma, categoria ou instrutor"
                            aria-label="Buscar turma"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            style={{ paddingLeft: 30, minWidth: 280 }}
                        />
                    </div>
                    <FilterChip type="button" $active={statusFilter === 'ALL'} onClick={() => setStatusFilter('ALL')}>
                        Todas ({courses.length})
                    </FilterChip>
                    {(Object.keys(STATUS_LABEL) as EventStatus[]).filter((status) => statusCounts[status]).map((status) => (
                        <FilterChip key={status} type="button" $active={statusFilter === status} onClick={() => setStatusFilter(status)}>
                            {STATUS_LABEL[status]} ({statusCounts[status]})
                        </FilterChip>
                    ))}
                </ToolbarGroup>
            </Toolbar>

            <TableWrapper>
                <ScrollX>
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
                        {visibleCourses.map((course) => (
                            <Tr key={course.id} onClick={() => navigate(`/courses/${course.id}`)} style={{ cursor: 'pointer' }}>
                                <Td><strong>{course.event.title}</strong></Td>
                                <Td>{course.category || '—'}</Td>
                                <Td>{formatDateOnly(course.event.startDate)}</Td>
                                <Td>{course.instructors.map((i) => i.user.name).join(', ') || '—'}</Td>
                                <Td>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <span>
                                            {course._count.enrollments}
                                            {course.vacancies ? ` / ${course.vacancies}` : ''}
                                        </span>
                                        {course.vacancies ? <MiniProgress $percent={(course._count.enrollments / course.vacancies) * 100} /> : null}
                                    </div>
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
                </ScrollX>
                {!isLoading && courses.length === 0 && <EmptyState>Nenhuma turma cadastrada ainda. Use “Nova turma” para começar.</EmptyState>}
                {courses.length > 0 && visibleCourses.length === 0 && (
                    <EmptyState>
                        Nenhuma turma encontrada com esse filtro.&nbsp;<Muted as="button" type="button" onClick={() => { setSearch(''); setStatusFilter('ALL'); }} style={{ background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Limpar filtros</Muted>
                    </EmptyState>
                )}
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
                        <Label htmlFor="defaultRoomId">Sala padrão (opcional)</Label>
                        <Controller
                            control={control}
                            name="defaultRoomId"
                            render={({ field }) => (
                                <RoomSelect id="defaultRoomId" value={field.value ?? ''} onChange={field.onChange} emptyLabel="Nenhuma" vacancies={Number(watch('vacancies')) || null} />
                            )}
                        />
                    </Field>

                    <FieldRow>
                        <Field>
                            <Label htmlFor="minAttendancePercent">Presença mínima p/ certificado (%)</Label>
                            <Input id="minAttendancePercent" type="number" min={0} max={100} {...register('minAttendancePercent')} />
                        </Field>
                        <Field>
                            <Label htmlFor="recyclingValidityMonths">Validade do certificado (meses, opcional)</Label>
                            <Input id="recyclingValidityMonths" type="number" min={1} placeholder="sem vencimento" {...register('recyclingValidityMonths')} />
                        </Field>
                    </FieldRow>

                    <CheckboxField>
                        <input type="checkbox" {...register('requireAllLessonsWatched')} />
                        Exigir todas as vídeo-aulas assistidas para emitir o certificado
                    </CheckboxField>

                    {courses.length > 0 && (
                        <Field>
                            <Label htmlFor="recommendedRecyclingCourseId">Curso de reciclagem recomendado (opcional)</Label>
                            <Select id="recommendedRecyclingCourseId" {...register('recommendedRecyclingCourseId')}>
                                <option value="">Nenhum</option>
                                {courses.map((c) => (
                                    <option key={c.id} value={c.id}>{c.event.title}</option>
                                ))}
                            </Select>
                        </Field>
                    )}

                    <Field>
                        <Label htmlFor="syllabus">Conteúdo programático (opcional)</Label>
                        <Textarea
                            id="syllabus"
                            rows={5}
                            placeholder="Cole ou escreva a ementa da turma — vira uma 2ª página no PDF do certificado."
                            {...register('syllabus')}
                        />
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
