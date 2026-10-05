// frontend/src/pages/course-detail/ScheduleDialogs.tsx
//
// Modais da aba Programação: grupo, atividade, salvar modelo e aplicar modelo.

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Field, Label, Input, Select, HelpText, ErrorText, Form, FormActions, FieldRow } from '@/components/ui/FormField';
import {
    courseScheduleApi,
    scheduleTemplatesApi,
    type ActivityInput,
    type CourseActivity,
    type CourseGroup,
    type ScheduleActivityKind,
} from '@/services/schedule';
import { toast } from '@/utils/toast';
import { apiErrorMessage } from '@/utils/apiError';
import { formatDateOnly } from '@/utils/courseDates';
import { RoomSelect } from './RoomSelect';
import { AssigneePicker, type AssigneeValue } from './AssigneePicker';
import { Muted } from './styles';

const useInvalidateSchedule = (courseId: string) => {
    const queryClient = useQueryClient();
    return () => {
        queryClient.invalidateQueries({ queryKey: ['courses', courseId] });
    };
};

export function GroupModal({ courseId, group, open, onOpenChange }: { courseId: string; group: CourseGroup | null; open: boolean; onOpenChange: (open: boolean) => void }) {
    const invalidate = useInvalidateSchedule(courseId);
    const [name, setName] = useState('');
    const [roomId, setRoomId] = useState('');

    useEffect(() => {
        if (!open) return;
        setName(group?.name ?? '');
        setRoomId(group?.roomId ?? '');
    }, [open, group]);

    const saveMutation = useMutation({
        mutationFn: () =>
            group
                ? courseScheduleApi.updateGroup(courseId, group.id, { name: name.trim(), roomId: roomId || null })
                : courseScheduleApi.createGroup(courseId, { name: name.trim(), roomId: roomId || undefined }),
        onSuccess: () => {
            toast.success(group ? 'Grupo atualizado.' : 'Grupo criado.');
            invalidate();
            onOpenChange(false);
        },
        onError: (error: unknown) => toast.error(apiErrorMessage(error, 'Não foi possível salvar o grupo.')),
    });

    return (
        <Modal open={open} onOpenChange={onOpenChange} title={group ? 'Editar grupo' : 'Novo grupo'}>
            <Form onSubmit={(e) => { e.preventDefault(); if (name.trim()) saveMutation.mutate(); }}>
                <HelpText>O grupo é um conjunto de alunos que faz a programação junto. A sala base é onde ele fica nas atividades sem local fixo.</HelpText>
                <Field>
                    <Label htmlFor="groupRoom">Sala base</Label>
                    <RoomSelect
                        id="groupRoom"
                        value={roomId}
                        emptyLabel="Nenhuma"
                        onChange={(id) => setRoomId(id)}
                        // Grupo sem nome ganha o nome da sala escolhida ("Sala 1"), que é como a academia já chama.
                        onRoomPicked={(room) => !name.trim() && setName(room.name)}
                    />
                </Field>
                <Field>
                    <Label htmlFor="groupName">Nome do grupo</Label>
                    <Input id="groupName" placeholder="ex: Sala 1" value={name} onChange={(e) => setName(e.target.value)} />
                </Field>
                <FormActions>
                    <Button type="button" $variant="secondary" onClick={() => onOpenChange(false)}>Cancelar</Button>
                    <Button type="submit" disabled={!name.trim() || saveMutation.isPending}>{saveMutation.isPending ? 'Salvando...' : 'Salvar grupo'}</Button>
                </FormActions>
            </Form>
        </Modal>
    );
}

export function ActivityModal({
    courseId,
    activity,
    open,
    onOpenChange,
}: {
    courseId: string;
    activity: CourseActivity | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const invalidate = useInvalidateSchedule(courseId);
    const [title, setTitle] = useState('');
    const [kind, setKind] = useState<ScheduleActivityKind>('ACTIVITY');
    const [duration, setDuration] = useState('');
    const [roomId, setRoomId] = useState('');
    const [assignees, setAssignees] = useState<AssigneeValue[]>([]);

    useEffect(() => {
        if (!open) return;
        setTitle(activity?.title ?? '');
        setKind(activity?.kind ?? 'ACTIVITY');
        setDuration(activity ? String(activity.durationMinutes) : '');
        setRoomId(activity?.roomId ?? '');
        setAssignees((activity?.assignees ?? []).map((a) => (a.teamId ? { teamId: a.teamId } : { userId: a.userId! })));
    }, [open, activity]);

    const isActivity = kind === 'ACTIVITY';
    const durationNumber = Number(duration);
    const valid = title.trim() && Number.isInteger(durationNumber) && durationNumber > 0;

    const saveMutation = useMutation({
        mutationFn: () => {
            const input: ActivityInput = {
                title: title.trim(),
                kind,
                durationMinutes: durationNumber,
                // Intervalo/refeição não ocupam sala nem têm responsável.
                roomId: isActivity ? roomId || null : null,
                assignees: isActivity ? assignees : [],
            };
            return activity ? courseScheduleApi.updateActivity(courseId, activity.id, input) : courseScheduleApi.createActivity(courseId, input);
        },
        onSuccess: () => {
            toast.success(activity ? 'Atividade atualizada.' : 'Atividade cadastrada.');
            invalidate();
            onOpenChange(false);
        },
        onError: (error: unknown) => toast.error(apiErrorMessage(error, 'Não foi possível salvar a atividade.')),
    });

    return (
        <Modal open={open} onOpenChange={onOpenChange} title={activity ? 'Editar atividade' : 'Nova atividade'} width="560px">
            <Form onSubmit={(e) => { e.preventDefault(); if (valid) saveMutation.mutate(); }}>
                <Field>
                    <Label htmlFor="activityTitle">Nome</Label>
                    <Input id="activityTitle" placeholder="ex: RCP e DEA" value={title} onChange={(e) => setTitle(e.target.value)} />
                </Field>
                <FieldRow>
                    <Field>
                        <Label htmlFor="activityKind">Tipo</Label>
                        <Select id="activityKind" value={kind} onChange={(e) => setKind(e.target.value as ScheduleActivityKind)}>
                            <option value="ACTIVITY">Atividade</option>
                            <option value="BREAK">Intervalo</option>
                            <option value="MEAL">Refeição (almoço)</option>
                        </Select>
                    </Field>
                    <Field>
                        <Label htmlFor="activityDuration">Duração (minutos)</Label>
                        <Input id="activityDuration" type="number" min={1} value={duration} onChange={(e) => setDuration(e.target.value)} />
                    </Field>
                </FieldRow>
                {kind === 'MEAL' && <HelpText>A refeição divide o dia em períodos: cada período (manhã, tarde) tem a sua chamada.</HelpText>}
                {isActivity && (
                    <>
                        <Field>
                            <Label htmlFor="activityRoom">Local</Label>
                            <RoomSelect id="activityRoom" value={roomId} onChange={setRoomId} emptyLabel="Sala base de cada grupo" />
                            <HelpText>Escolha um local só se a atividade sempre acontece nele (ex: Área da prática).</HelpText>
                        </Field>
                        <Field>
                            <Label>Responsáveis</Label>
                            <AssigneePicker value={assignees} onChange={setAssignees} />
                            <HelpText>Quem for escolhido (ou fizer parte da equipe escolhida) vira instrutor da turma.</HelpText>
                        </Field>
                    </>
                )}
                {activity && Number(duration) !== activity.durationMinutes && valid && (
                    <HelpText>Os horários de todos os grupos que têm esta atividade serão recalculados.</HelpText>
                )}
                <FormActions>
                    <Button type="button" $variant="secondary" onClick={() => onOpenChange(false)}>Cancelar</Button>
                    <Button type="submit" disabled={!valid || saveMutation.isPending}>{saveMutation.isPending ? 'Salvando...' : 'Salvar atividade'}</Button>
                </FormActions>
            </Form>
        </Modal>
    );
}

export function SaveTemplateModal({ courseId, defaultName, open, onOpenChange }: { courseId: string; defaultName: string; open: boolean; onOpenChange: (open: boolean) => void }) {
    const queryClient = useQueryClient();
    const [name, setName] = useState('');
    const { data: templates } = useQuery({ queryKey: ['schedule-templates'], queryFn: () => scheduleTemplatesApi.list(), enabled: open });

    useEffect(() => {
        if (open) setName(defaultName);
    }, [open, defaultName]);

    const saveMutation = useMutation({
        mutationFn: () => courseScheduleApi.saveTemplate(courseId, name.trim()),
        onSuccess: (template) => {
            toast.success(`Modelo "${template.name}" salvo.`);
            queryClient.invalidateQueries({ queryKey: ['schedule-templates'] });
            onOpenChange(false);
        },
        onError: (error: unknown) => toast.error(apiErrorMessage(error, 'Não foi possível salvar o modelo.')),
    });

    const overwriting = (templates ?? []).some((t) => t.name === name.trim());

    return (
        <Modal open={open} onOpenChange={onOpenChange} title="Salvar como modelo">
            <Form onSubmit={(e) => { e.preventDefault(); if (name.trim()) saveMutation.mutate(); }}>
                <HelpText>Guarda os grupos, as atividades (com local e responsáveis) e a ordem de cada grupo, para montar a próxima turma igual.</HelpText>
                <Field>
                    <Label htmlFor="templateName">Nome do modelo</Label>
                    <Input id="templateName" placeholder="ex: Treinamento Intermediário" value={name} onChange={(e) => setName(e.target.value)} />
                    {overwriting && <ErrorText>Já existe um modelo com esse nome: ele será substituído por esta programação.</ErrorText>}
                </Field>
                <FormActions>
                    <Button type="button" $variant="secondary" onClick={() => onOpenChange(false)}>Cancelar</Button>
                    <Button type="submit" disabled={!name.trim() || saveMutation.isPending}>{saveMutation.isPending ? 'Salvando...' : 'Salvar modelo'}</Button>
                </FormActions>
            </Form>
        </Modal>
    );
}

export function ApplyTemplateModal({ courseId, defaultDate, open, onOpenChange }: { courseId: string; defaultDate: string; open: boolean; onOpenChange: (open: boolean) => void }) {
    const queryClient = useQueryClient();
    const invalidate = useInvalidateSchedule(courseId);
    const { data: templates } = useQuery({ queryKey: ['schedule-templates'], queryFn: () => scheduleTemplatesApi.list(), enabled: open });
    const [templateId, setTemplateId] = useState('');
    const [date, setDate] = useState('');

    useEffect(() => {
        if (open) setDate(defaultDate);
    }, [open, defaultDate]);
    useEffect(() => {
        if (open && !templateId && templates?.length) setTemplateId(templates[0].id);
    }, [open, templateId, templates]);

    const applyMutation = useMutation({
        mutationFn: () => courseScheduleApi.applyTemplate(courseId, templateId, date),
        onSuccess: () => {
            toast.success('Programação montada a partir do modelo.');
            invalidate();
            onOpenChange(false);
        },
        onError: (error: unknown) => toast.error(apiErrorMessage(error, 'Não foi possível aplicar o modelo.')),
    });

    const removeMutation = useMutation({
        mutationFn: (id: string) => scheduleTemplatesApi.remove(id),
        onSuccess: () => {
            toast.success('Modelo excluído.');
            setTemplateId('');
            queryClient.invalidateQueries({ queryKey: ['schedule-templates'] });
        },
        onError: (error: unknown) => toast.error(apiErrorMessage(error, 'Não foi possível excluir o modelo.')),
    });

    const selected = (templates ?? []).find((t) => t.id === templateId);

    return (
        <Modal open={open} onOpenChange={onOpenChange} title="Montar a partir de um modelo">
            {templates && templates.length === 0 ? (
                <HelpText>Nenhum modelo salvo ainda. Monte a programação de uma turma e use “Salvar como modelo”.</HelpText>
            ) : (
                <Form onSubmit={(e) => { e.preventDefault(); if (templateId && date) applyMutation.mutate(); }}>
                    <Field>
                        <Label htmlFor="applyTemplate">Modelo</Label>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <Select id="applyTemplate" value={templateId} onChange={(e) => setTemplateId(e.target.value)} style={{ flex: 1 }}>
                                {(templates ?? []).map((t) => (
                                    <option key={t.id} value={t.id}>{t.name}</option>
                                ))}
                            </Select>
                            {selected && (
                                <Button
                                    type="button"
                                    $variant="ghost"
                                    aria-label={`Excluir o modelo ${selected.name}`}
                                    title="Excluir modelo"
                                    onClick={() => window.confirm(`Excluir o modelo "${selected.name}"? Turmas já montadas com ele não mudam.`) && removeMutation.mutate(selected.id)}
                                >
                                    <Trash2 size={14} />
                                </Button>
                            )}
                        </div>
                        {selected && (
                            <Muted>
                                {selected.groups} {selected.groups === 1 ? 'grupo' : 'grupos'} · {selected.activities} atividades · {selected.days} {selected.days === 1 ? 'dia' : 'dias'} · salvo em {formatDateOnly(selected.updatedAt)}
                            </Muted>
                        )}
                    </Field>
                    <Field>
                        <Label htmlFor="applyDate">Primeiro dia</Label>
                        <Input id="applyDate" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                    </Field>
                    <HelpText>Salas, equipes ou pessoas do modelo que foram desativadas ficam de fora; confira depois.</HelpText>
                    <FormActions>
                        <Button type="button" $variant="secondary" onClick={() => onOpenChange(false)}>Cancelar</Button>
                        <Button type="submit" disabled={!templateId || !date || applyMutation.isPending}>{applyMutation.isPending ? 'Montando...' : 'Montar programação'}</Button>
                    </FormActions>
                </Form>
            )}
        </Modal>
    );
}
