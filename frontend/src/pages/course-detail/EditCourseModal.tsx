// frontend/src/pages/course-detail/EditCourseModal.tsx
//
// Edição da turma em seções: dados básicos (antes só dava para editar os critérios do
// certificado; título, datas, local, vagas e status não tinham tela de edição), certificado e
// instrutores. Campo esvaziado é enviado como `null` para o backend limpar o valor — antes
// virava `undefined` e o valor antigo permanecia.

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import styled from 'styled-components';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Field, Label, Input, Select, Textarea, ErrorText, HelpText, Form, FormActions, FieldRow, CheckboxField } from '@/components/ui/FormField';
import { coursesApi } from '@/services/courses';
import { peopleApi } from '@/services/people';
import { toast } from '@/utils/toast';
import { apiErrorMessage } from '@/utils/apiError';
import { toDateOnly } from '@/utils/courseDates';
import type { Course, EventStatus } from '@/types';

const STATUS_OPTIONS: { value: EventStatus; label: string }[] = [
    { value: 'SCHEDULED', label: 'Agendada' },
    { value: 'ONGOING', label: 'Em andamento' },
    { value: 'COMPLETED', label: 'Concluída' },
    { value: 'CANCELLED', label: 'Cancelada' },
];

interface FormData {
    title: string;
    category: string;
    startDate: string;
    endDate: string;
    location: string;
    vacancies: string;
    status: EventStatus;
    minAttendancePercent: string;
    recyclingValidityMonths: string;
    requireAllLessonsWatched: boolean;
    recommendedRecyclingCourseId: string;
    syllabus: string;
}

const SectionTitle = styled.h3`
    margin: 0.5rem 0 0;
    padding-top: 0.75rem;
    border-top: 1px solid ${({ theme }) => theme.colors.borderLight};
    font-size: 0.8125rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    color: ${({ theme }) => theme.colors.textMedium};

    &:first-of-type {
        margin-top: 0;
        padding-top: 0;
        border-top: none;
    }
`;

const InstructorChip = styled.span`
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.2rem 0.3rem 0.2rem 0.65rem;
    border-radius: ${({ theme }) => theme.radii.pill};
    background: ${({ theme }) => theme.colors.primaryLight};
    color: ${({ theme }) => theme.colors.infoDark};
    font-size: 0.8125rem;
    font-weight: 600;

    button {
        display: flex;
        background: transparent;
        border: none;
        cursor: pointer;
        color: inherit;
        padding: 0.1rem;
        border-radius: 50%;
    }

    button:hover {
        background: rgba(3, 105, 161, 0.15);
    }
`;

const emptyToNull = (value: string) => (value.trim() === '' ? null : value.trim());
const numberOrNull = (value: string) => (value.trim() === '' ? null : Number(value));

interface EditCourseModalProps {
    course: Course;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Adicionar/remover instrutor e listar pessoas exigem, respectivamente, courses:manage e people:manage. */
    canListPeople: boolean;
}

export function EditCourseModal({ course, open, onOpenChange, canListPeople }: EditCourseModalProps) {
    const queryClient = useQueryClient();
    const courseId = course.id;

    const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<FormData>();

    const { data: allCoursesData } = useQuery({ queryKey: ['courses'], queryFn: () => coursesApi.list(), enabled: open });
    const { data: peopleData } = useQuery({ queryKey: ['people', {}], queryFn: () => peopleApi.list(), enabled: open && canListPeople });

    // Reinicia o formulário sempre que o modal abre (ou a turma é recarregada com dados novos).
    useEffect(() => {
        if (!open) return;
        reset({
            title: course.event.title,
            category: course.category ?? '',
            startDate: toDateOnly(course.event.startDate),
            endDate: course.event.endDate ? toDateOnly(course.event.endDate) : '',
            location: course.event.location ?? '',
            vacancies: course.vacancies ? String(course.vacancies) : '',
            status: course.event.status,
            minAttendancePercent: String(course.minAttendancePercent),
            recyclingValidityMonths: course.recyclingValidityMonths ? String(course.recyclingValidityMonths) : '',
            requireAllLessonsWatched: course.requireAllLessonsWatched,
            recommendedRecyclingCourseId: course.recommendedRecyclingCourseId ?? '',
            syllabus: course.syllabus ?? '',
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, course.id]);

    const updateMutation = useMutation({
        mutationFn: (input: FormData) =>
            coursesApi.update(courseId, {
                title: input.title.trim(),
                category: emptyToNull(input.category),
                startDate: input.startDate,
                endDate: emptyToNull(input.endDate),
                location: emptyToNull(input.location),
                vacancies: numberOrNull(input.vacancies),
                status: input.status,
                minAttendancePercent: input.minAttendancePercent === '' ? 75 : Number(input.minAttendancePercent),
                requireAllLessonsWatched: input.requireAllLessonsWatched,
                recyclingValidityMonths: numberOrNull(input.recyclingValidityMonths),
                recommendedRecyclingCourseId: emptyToNull(input.recommendedRecyclingCourseId),
                syllabus: emptyToNull(input.syllabus),
            }),
        onSuccess: () => {
            toast.success('Turma atualizada.');
            queryClient.invalidateQueries({ queryKey: ['courses'] });
            onOpenChange(false);
        },
        onError: (error: unknown) => toast.error(apiErrorMessage(error, 'Não foi possível salvar a turma.')),
    });

    const refreshCourse = () => queryClient.invalidateQueries({ queryKey: ['courses', courseId] });

    const assignMutation = useMutation({
        mutationFn: (userId: string) => coursesApi.assignInstructor(courseId, userId),
        onSuccess: () => { toast.success('Instrutor adicionado.'); refreshCourse(); },
        onError: (error: unknown) => toast.error(apiErrorMessage(error, 'Não foi possível adicionar o instrutor.')),
    });

    const removeInstructorMutation = useMutation({
        mutationFn: (userId: string) => coursesApi.removeInstructor(courseId, userId),
        onSuccess: () => { toast.success('Instrutor removido.'); refreshCourse(); },
        onError: (error: unknown) => toast.error(apiErrorMessage(error, 'Não foi possível remover o instrutor.')),
    });

    const startDate = watch('startDate');
    const instructorIds = new Set(course.instructors.map((i) => i.userId));
    const candidates = (peopleData?.data ?? []).filter((p) => !instructorIds.has(p.id));

    return (
        <Modal open={open} onOpenChange={onOpenChange} title="Editar turma" width="620px">
            <Form onSubmit={handleSubmit((data) => updateMutation.mutate(data))}>
                <SectionTitle>Dados da turma</SectionTitle>
                <Field>
                    <Label htmlFor="editTitle">Título</Label>
                    <Input id="editTitle" {...register('title', { required: 'Informe o título da turma' })} />
                    {errors.title && <ErrorText>{errors.title.message}</ErrorText>}
                </Field>
                <FieldRow>
                    <Field>
                        <Label htmlFor="editCategory">Categoria</Label>
                        <Input id="editCategory" placeholder="ex: Brigada de Incêndio" {...register('category')} />
                    </Field>
                    <Field>
                        <Label htmlFor="editStatus">Situação</Label>
                        <Select id="editStatus" {...register('status')}>
                            {STATUS_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </Select>
                    </Field>
                </FieldRow>
                <FieldRow>
                    <Field>
                        <Label htmlFor="editStartDate">Data de início</Label>
                        <Input id="editStartDate" type="date" {...register('startDate', { required: 'Informe a data de início' })} />
                        {errors.startDate && <ErrorText>{errors.startDate.message}</ErrorText>}
                    </Field>
                    <Field>
                        <Label htmlFor="editEndDate">Data de término (opcional)</Label>
                        <Input
                            id="editEndDate"
                            type="date"
                            min={startDate || undefined}
                            {...register('endDate', { validate: (value) => !value || !startDate || value >= startDate || 'O término deve ser depois do início' })}
                        />
                        {errors.endDate && <ErrorText>{errors.endDate.message}</ErrorText>}
                    </Field>
                </FieldRow>
                <FieldRow>
                    <Field>
                        <Label htmlFor="editLocation">Local</Label>
                        <Input id="editLocation" {...register('location')} />
                    </Field>
                    <Field>
                        <Label htmlFor="editVacancies">Vagas</Label>
                        <Input
                            id="editVacancies"
                            type="number"
                            min={1}
                            placeholder="sem limite"
                            {...register('vacancies', {
                                validate: (value) =>
                                    !value || Number(value) >= course._count.enrollments || `Já existem ${course._count.enrollments} matrículas ativas`,
                            })}
                        />
                        {errors.vacancies && <ErrorText>{errors.vacancies.message}</ErrorText>}
                    </Field>
                </FieldRow>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                    <SectionTitle>Instrutores</SectionTitle>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                        {course.instructors.length === 0 && <HelpText>Nenhum instrutor definido.</HelpText>}
                        {course.instructors.map((instructor) => (
                            <InstructorChip key={instructor.userId}>
                                {instructor.user.name}
                                <button
                                    type="button"
                                    aria-label={`Remover ${instructor.user.name}`}
                                    disabled={removeInstructorMutation.isPending}
                                    onClick={() => {
                                        if (window.confirm(`Remover ${instructor.user.name} desta turma?`)) removeInstructorMutation.mutate(instructor.userId);
                                    }}
                                >
                                    <X size={14} />
                                </button>
                            </InstructorChip>
                        ))}
                    </div>
                    {canListPeople ? (
                        <Select
                            aria-label="Adicionar instrutor"
                            value=""
                            disabled={assignMutation.isPending || candidates.length === 0}
                            onChange={(e) => e.target.value && assignMutation.mutate(e.target.value)}
                        >
                            <option value="">{candidates.length === 0 ? 'Todas as pessoas já são instrutoras' : 'Adicionar instrutor…'}</option>
                            {candidates.map((person) => (
                                <option key={person.id} value={person.id}>{person.name}</option>
                            ))}
                        </Select>
                    ) : (
                        <HelpText>Para adicionar instrutores é preciso ter acesso ao cadastro de pessoas.</HelpText>
                    )}
                    <HelpText>Mudanças nos instrutores são aplicadas na hora, sem precisar salvar a turma.</HelpText>
                </div>

                <SectionTitle>Certificado</SectionTitle>
                <FieldRow>
                    <Field>
                        <Label htmlFor="editMinAttendancePercent">Presença mínima (%)</Label>
                        <Input id="editMinAttendancePercent" type="number" min={0} max={100} {...register('minAttendancePercent')} />
                    </Field>
                    <Field>
                        <Label htmlFor="editRecyclingValidityMonths">Validade (meses)</Label>
                        <Input id="editRecyclingValidityMonths" type="number" min={1} placeholder="sem vencimento" {...register('recyclingValidityMonths')} />
                    </Field>
                </FieldRow>
                <CheckboxField>
                    <input type="checkbox" {...register('requireAllLessonsWatched')} />
                    Exigir todas as vídeo-aulas assistidas para emitir o certificado
                </CheckboxField>
                <Field>
                    <Label htmlFor="editRecommendedRecyclingCourseId">Curso de reciclagem recomendado (opcional)</Label>
                    <Select id="editRecommendedRecyclingCourseId" {...register('recommendedRecyclingCourseId')}>
                        <option value="">Nenhum</option>
                        {(allCoursesData?.data ?? []).filter((c) => c.id !== courseId).map((c) => (
                            <option key={c.id} value={c.id}>{c.event.title}</option>
                        ))}
                    </Select>
                </Field>
                <Field>
                    <Label htmlFor="editSyllabus">Conteúdo programático (opcional)</Label>
                    <Textarea id="editSyllabus" rows={5} placeholder="Cole ou escreva a ementa da turma — vira uma 2ª página no PDF do certificado." {...register('syllabus')} />
                </Field>

                <FormActions>
                    <Button type="button" $variant="secondary" onClick={() => onOpenChange(false)}>Cancelar</Button>
                    <Button type="submit" disabled={updateMutation.isPending}>{updateMutation.isPending ? 'Salvando...' : 'Salvar turma'}</Button>
                </FormActions>
            </Form>

        </Modal>
    );
}
