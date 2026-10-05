// frontend/src/pages/course-detail/ScheduleTab.tsx
//
// Programação da turma, pensada a partir da planilha que a academia já usava (uma aba por sala,
// com hora de início, tempo, atividade, hora final e instrutores):
// - Grupos (Sala 1, Sala 2...) lado a lado, cada um com a sua sequência de atividades.
// - As atividades são cadastradas uma vez; em cada grupo só se escolhe a ordem. Os horários são
//   calculados pelo sistema (na planilha eram digitados e saíam errados).
// - Avisos: atividade que falta num grupo, sala ocupada duas vezes, pessoa em dois lugares.
// - Cada mudança é salva na hora; o backend gera um período de chamada por trecho entre refeições.
// Aluno vê só a programação do grupo dele, sem os controles.

import { useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, ArrowUp, ArrowDown, X, AlertTriangle, Save, LayoutTemplate, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input, Select, HelpText } from '@/components/ui/FormField';
import { Table, TableWrapper, Thead, Tr, Th, Td, EmptyState, Badge } from '@/components/ui/Table';
import { courseScheduleApi, KIND_LABEL, type CourseActivity, type CourseGroup, type ScheduleBlock } from '@/services/schedule';
import { toast } from '@/utils/toast';
import { apiErrorMessage } from '@/utils/apiError';
import { formatDateWithWeekday, toDateOnly } from '@/utils/courseDates';
import { ActivityModal, ApplyTemplateModal, GroupModal, SaveTemplateModal } from './ScheduleDialogs';
import { Muted, ScrollX, Toolbar, ToolbarGroup } from './styles';

const Section = styled.section`
    margin-bottom: 1.5rem;

    h3 {
        margin: 0 0 0.6rem;
        font-size: 0.9375rem;
        font-weight: 700;
        color: ${({ theme }) => theme.colors.textDark};
    }
`;

const Columns = styled.div`
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: minmax(300px, 1fr);
    gap: 0.75rem;
    overflow-x: auto;
    padding-bottom: 0.25rem;
`;

const Column = styled.div`
    background: ${({ theme }) => theme.colors.white};
    border: 1px solid ${({ theme }) => theme.colors.borderLight};
    border-radius: ${({ theme }) => theme.radii.md};
    display: flex;
    flex-direction: column;
    min-width: 0;
`;

const ColumnHeader = styled.div`
    padding: 0.65rem 0.75rem;
    border-bottom: 1px solid ${({ theme }) => theme.colors.borderLight};
    display: flex;
    flex-direction: column;
    gap: 0.45rem;

    strong {
        font-size: 0.875rem;
        color: ${({ theme }) => theme.colors.textDark};
    }
`;

const BlockRow = styled.div<{ $kind: string; $warn?: boolean }>`
    display: grid;
    grid-template-columns: 78px 1fr auto;
    gap: 0.5rem;
    align-items: center;
    padding: 0.4rem 0.75rem;
    border-top: 1px solid ${({ theme }) => theme.colors.borderLight};
    font-size: 0.8125rem;
    background: ${({ $kind }) => ($kind === 'MEAL' ? '#fffbe6' : $kind === 'BREAK' ? '#f1f8f1' : 'transparent')};
    box-shadow: ${({ $warn }) => ($warn ? 'inset 4px 0 0 #e67700' : 'none')};

    &:first-child {
        border-top: none;
    }
`;

const Time = styled.span`
    font-variant-numeric: tabular-nums;
    font-weight: 600;
    color: ${({ theme }) => theme.colors.textMedium};
    font-size: 0.75rem;
`;

const BlockInfo = styled.div`
    min-width: 0;
    display: flex;
    flex-direction: column;

    strong {
        color: ${({ theme }) => theme.colors.textDark};
        font-weight: 600;
    }
`;

const IconButton = styled.button`
    display: inline-flex;
    background: transparent;
    border: none;
    cursor: pointer;
    padding: 0.15rem;
    border-radius: ${({ theme }) => theme.radii.sm};
    color: ${({ theme }) => theme.colors.textMuted};

    &:hover:not(:disabled) {
        background: ${({ theme }) => theme.colors.lightGray};
        color: ${({ theme }) => theme.colors.textDark};
    }

    &:disabled {
        opacity: 0.35;
        cursor: default;
    }
`;

const ColumnFooter = styled.div`
    padding: 0.6rem 0.75rem;
    border-top: 1px solid ${({ theme }) => theme.colors.borderLight};
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    margin-top: auto;
`;

const Warnings = styled.div`
    border: 1px solid #f5d77a;
    background: #fff8e1;
    border-radius: ${({ theme }) => theme.radii.md};
    padding: 0.6rem 0.85rem;
    margin-bottom: 0.75rem;
    font-size: 0.8125rem;
    color: #7a5b00;

    ul {
        margin: 0.35rem 0 0;
        padding-left: 1.1rem;
    }
`;

/** Coluna da programação: um grupo, ou a turma inteira quando ela não é dividida. */
type ScheduleColumn = { key: string; groupId: string | null; title: string; subtitle?: string };

const assigneeNames = (activity: CourseActivity) =>
    activity.assignees.map((a) => a.team?.name ?? a.user?.name).filter(Boolean).join(' / ');

export function ScheduleTab({ courseId, canManage, courseStartDate, courseTitle }: { courseId: string; canManage: boolean; courseStartDate: string; courseTitle: string }) {
    const queryClient = useQueryClient();
    const { data: schedule, isLoading } = useQuery({ queryKey: ['courses', courseId, 'schedule'], queryFn: () => courseScheduleApi.get(courseId) });

    const [groupModal, setGroupModal] = useState<{ open: boolean; group: CourseGroup | null }>({ open: false, group: null });
    const [activityModal, setActivityModal] = useState<{ open: boolean; activity: CourseActivity | null }>({ open: false, activity: null });
    const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);
    const [applyTemplateOpen, setApplyTemplateOpen] = useState(false);
    const [selectedDate, setSelectedDate] = useState('');
    // Horário de início de colunas ainda vazias (as já montadas usam o do primeiro bloco).
    const [draftStart, setDraftStart] = useState<Record<string, string>>({});

    const groups = useMemo(() => schedule?.groups ?? [], [schedule]);
    const activities = useMemo(() => schedule?.activities ?? [], [schedule]);
    const blocks = useMemo(() => schedule?.blocks ?? [], [schedule]);
    const activityById = useMemo(() => new Map(activities.map((a) => [a.id, a])), [activities]);

    const dates = useMemo(() => {
        const set = new Set(blocks.map((b) => toDateOnly(b.date)));
        set.add(toDateOnly(courseStartDate));
        return [...set].sort();
    }, [blocks, courseStartDate]);

    useEffect(() => {
        if (!selectedDate && dates.length > 0) {
            setSelectedDate(blocks.length > 0 ? toDateOnly(blocks[0].date) : dates[0]);
        }
    }, [dates, blocks, selectedDate]);

    const columns: ScheduleColumn[] = groups.length > 0
        ? groups.map((g) => ({ key: g.id, groupId: g.id, title: g.name, subtitle: g.room ? `Sala base: ${g.room.name}` : 'Sem sala base' }))
        : [{ key: 'whole', groupId: null, title: 'Turma inteira' }];
    // Turma com grupos mas com programação antiga "da turma inteira" ainda aparece.
    if (groups.length > 0 && blocks.some((b) => b.groupId === null)) {
        columns.push({ key: 'whole', groupId: null, title: 'Turma inteira' });
    }

    const dayBlocks = (groupId: string | null) =>
        blocks.filter((b) => b.groupId === groupId && toDateOnly(b.date) === selectedDate).sort((a, b) => a.order - b.order);

    const conflicts = (schedule?.conflicts ?? []).filter((c) => c.date === selectedDate);
    const conflictBlockIds = new Set(conflicts.flatMap((c) => c.blockIds));

    const saveDayMutation = useMutation({
        mutationFn: (input: { groupId: string | null; startTime: string; activityIds: string[] }) => courseScheduleApi.saveDay(courseId, { ...input, date: selectedDate }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['courses', courseId] });
        },
        onError: (error: unknown) => toast.error(apiErrorMessage(error, 'Não foi possível salvar a programação.')),
    });

    const removeGroupMutation = useMutation({
        mutationFn: (groupId: string) => courseScheduleApi.removeGroup(courseId, groupId),
        onSuccess: () => { toast.success('Grupo excluído.'); queryClient.invalidateQueries({ queryKey: ['courses', courseId] }); },
        onError: (error: unknown) => toast.error(apiErrorMessage(error, 'Não foi possível excluir o grupo.')),
    });

    const removeActivityMutation = useMutation({
        mutationFn: (activityId: string) => courseScheduleApi.removeActivity(courseId, activityId),
        onSuccess: () => { toast.success('Atividade excluída.'); queryClient.invalidateQueries({ queryKey: ['courses', courseId] }); },
        onError: (error: unknown) => toast.error(apiErrorMessage(error, 'Não foi possível excluir a atividade.')),
    });

    const save = (column: ScheduleColumn, activityIds: string[], startTime?: string) => {
        const current = dayBlocks(column.groupId);
        saveDayMutation.mutate({
            groupId: column.groupId,
            startTime: startTime ?? current[0]?.startTime ?? draftStart[column.key] ?? '08:00',
            activityIds,
        });
    };

    const idsOf = (list: ScheduleBlock[]) => list.map((b) => b.activityId);

    const move = (column: ScheduleColumn, index: number, delta: number) => {
        const ids = idsOf(dayBlocks(column.groupId));
        const target = index + delta;
        if (target < 0 || target >= ids.length) return;
        [ids[index], ids[target]] = [ids[target], ids[index]];
        save(column, ids);
    };

    const copyFrom = (column: ScheduleColumn, sourceKey: string) => {
        const source = columns.find((c) => c.key === sourceKey);
        if (!source) return;
        const sourceBlocks = dayBlocks(source.groupId);
        if (dayBlocks(column.groupId).length > 0 && !window.confirm(`Substituir a programação de ${column.title} pela de ${source.title}?`)) return;
        save(column, idsOf(sourceBlocks), sourceBlocks[0]?.startTime);
    };

    /** Atividades (não intervalos) que ainda não aparecem em nenhum dia deste grupo. */
    const missingFor = (groupId: string | null) => {
        const used = new Set(blocks.filter((b) => b.groupId === groupId).map((b) => b.activityId));
        return activities.filter((a) => a.kind === 'ACTIVITY' && !used.has(a.id));
    };

    if (isLoading) return <EmptyState>Carregando programação...</EmptyState>;

    const busy = saveDayMutation.isPending;

    return (
        <div>
            {canManage && (
                <Toolbar>
                    <ToolbarGroup>
                        <Muted style={{ fontSize: '0.8125rem' }}>
                            Monte como na planilha: grupos lado a lado, atividades em ordem. Os horários são calculados sozinhos.
                        </Muted>
                    </ToolbarGroup>
                    <ToolbarGroup>
                        {activities.length === 0 && (
                            <Button $variant="secondary" onClick={() => setApplyTemplateOpen(true)}>
                                <LayoutTemplate size={14} /> Usar um modelo
                            </Button>
                        )}
                        {activities.length > 0 && (
                            <Button $variant="secondary" onClick={() => setSaveTemplateOpen(true)}>
                                <Save size={14} /> Salvar como modelo
                            </Button>
                        )}
                    </ToolbarGroup>
                </Toolbar>
            )}

            {canManage && (
                <Section>
                    <Toolbar style={{ marginBottom: '0.5rem' }}>
                        <h3 style={{ margin: 0 }}>Grupos</h3>
                        <Button onClick={() => setGroupModal({ open: true, group: null })}>
                            <Plus size={14} /> Grupo
                        </Button>
                    </Toolbar>
                    {groups.length === 0 ? (
                        <HelpText>
                            Turma sem grupos: a programação vale para todos. Divida em grupos (ex: Sala 1, Sala 2, Sala 3) quando cada um fizer as atividades em uma ordem.
                        </HelpText>
                    ) : (
                        <ToolbarGroup>
                            {groups.map((group) => (
                                <Badge key={group.id} $tone="info" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.3rem 0.4rem 0.3rem 0.65rem' }}>
                                    {group.name}
                                    <Muted>· {group._count.enrollments} {group._count.enrollments === 1 ? 'aluno' : 'alunos'}</Muted>
                                    <IconButton type="button" aria-label={`Editar o grupo ${group.name}`} onClick={() => setGroupModal({ open: true, group })}>
                                        <Pencil size={13} />
                                    </IconButton>
                                    <IconButton
                                        type="button"
                                        aria-label={`Excluir o grupo ${group.name}`}
                                        onClick={() =>
                                            window.confirm(`Excluir o grupo "${group.name}"? A programação e os períodos de chamada dele são apagados; os alunos ficam sem grupo.`) &&
                                            removeGroupMutation.mutate(group.id)
                                        }
                                    >
                                        <Trash2 size={13} />
                                    </IconButton>
                                </Badge>
                            ))}
                            <Muted>Os alunos são colocados nos grupos pela aba Matrículas.</Muted>
                        </ToolbarGroup>
                    )}
                </Section>
            )}

            {canManage && (
                <Section>
                    <Toolbar style={{ marginBottom: '0.5rem' }}>
                        <h3 style={{ margin: 0 }}>Atividades da turma</h3>
                        <Button onClick={() => setActivityModal({ open: true, activity: null })}>
                            <Plus size={14} /> Atividade
                        </Button>
                    </Toolbar>
                    <TableWrapper>
                        <ScrollX>
                            <Table>
                                <Thead>
                                    <tr>
                                        <Th>Atividade</Th>
                                        <Th>Tempo</Th>
                                        <Th>Local</Th>
                                        <Th>Responsáveis</Th>
                                        <Th></Th>
                                    </tr>
                                </Thead>
                                <tbody>
                                    {activities.map((activity) => (
                                        <Tr key={activity.id}>
                                            <Td>
                                                <strong>{activity.title}</strong>
                                                {activity.kind !== 'ACTIVITY' && <Badge style={{ marginLeft: '0.4rem' }}>{KIND_LABEL[activity.kind]}</Badge>}
                                            </Td>
                                            <Td style={{ whiteSpace: 'nowrap' }}>{activity.durationMinutes} min</Td>
                                            <Td>{activity.kind === 'ACTIVITY' ? (activity.room?.name ?? <Muted>Sala do grupo</Muted>) : '—'}</Td>
                                            <Td>{assigneeNames(activity) || <Muted>—</Muted>}</Td>
                                            <Td>
                                                <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'flex-end' }}>
                                                    <Button $variant="ghost" aria-label={`Editar ${activity.title}`} title="Editar" onClick={() => setActivityModal({ open: true, activity })}>
                                                        <Pencil size={14} />
                                                    </Button>
                                                    <Button
                                                        $variant="ghost"
                                                        aria-label={`Excluir ${activity.title}`}
                                                        title="Excluir"
                                                        disabled={removeActivityMutation.isPending}
                                                        onClick={() =>
                                                            window.confirm(`Excluir "${activity.title}"? Ela sai da programação de todos os grupos e os horários são recalculados.`) &&
                                                            removeActivityMutation.mutate(activity.id)
                                                        }
                                                    >
                                                        <Trash2 size={14} />
                                                    </Button>
                                                </div>
                                            </Td>
                                        </Tr>
                                    ))}
                                </tbody>
                            </Table>
                        </ScrollX>
                        {activities.length === 0 && (
                            <EmptyState>
                                Cadastre cada atividade uma vez (ex: RCP e DEA, 40 min, Equipe de Ana), além dos intervalos e do almoço. Depois é só ordenar em cada grupo.
                            </EmptyState>
                        )}
                    </TableWrapper>
                </Section>
            )}

            <Section>
                <Toolbar style={{ marginBottom: '0.5rem' }}>
                    <h3 style={{ margin: 0 }}>{canManage ? 'Programação do dia' : 'Programação'}</h3>
                    <ToolbarGroup>
                        {dates.length > 1 && (
                            <Select aria-label="Dia da programação" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} style={{ width: 'auto' }}>
                                {dates.map((d) => (
                                    <option key={d} value={d}>{formatDateWithWeekday(d)}</option>
                                ))}
                            </Select>
                        )}
                        {dates.length <= 1 && selectedDate && <strong style={{ textTransform: 'capitalize', fontSize: '0.875rem' }}>{formatDateWithWeekday(selectedDate)}</strong>}
                        {canManage && (
                            <Input
                                type="date"
                                aria-label="Ir para outro dia"
                                title="Programar outro dia"
                                value=""
                                onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
                                style={{ width: 'auto' }}
                            />
                        )}
                    </ToolbarGroup>
                </Toolbar>

                {canManage && conflicts.length > 0 && (
                    <Warnings role="status">
                        <strong><AlertTriangle size={14} style={{ verticalAlign: '-2px' }} /> {conflicts.length === 1 ? '1 conflito' : `${conflicts.length} conflitos`} neste dia</strong>
                        <ul>
                            {conflicts.map((c, i) => (
                                <li key={i}>{c.message}</li>
                            ))}
                        </ul>
                    </Warnings>
                )}

                {canManage && activities.length === 0 ? (
                    <HelpText>Cadastre as atividades acima para montar a programação.</HelpText>
                ) : (
                    <Columns>
                        {columns.map((column) => {
                            const list = dayBlocks(column.groupId);
                            const usedIds = new Set(blocks.filter((b) => b.groupId === column.groupId).map((b) => b.activityId));
                            const missing = missingFor(column.groupId);
                            const startValue = list[0]?.startTime ?? draftStart[column.key] ?? '08:00';
                            return (
                                <Column key={column.key}>
                                    <ColumnHeader>
                                        <div>
                                            <strong>{column.title}</strong>
                                            {column.subtitle && <Muted style={{ display: 'block' }}>{column.subtitle}</Muted>}
                                        </div>
                                        {canManage && (
                                            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                                                <Muted>Início</Muted>
                                                <Input
                                                    // Salva ao sair do campo: o input de hora dispara a cada dígito digitado.
                                                    key={`${selectedDate}-${startValue}`}
                                                    type="time"
                                                    aria-label={`Início do dia — ${column.title}`}
                                                    defaultValue={startValue}
                                                    disabled={busy}
                                                    style={{ width: 'auto', padding: '0.3rem 0.5rem' }}
                                                    onBlur={(e) => {
                                                        const value = e.target.value;
                                                        if (!value || value === startValue) return;
                                                        if (list.length === 0) setDraftStart((d) => ({ ...d, [column.key]: value }));
                                                        else save(column, idsOf(list), value);
                                                    }}
                                                />
                                                {columns.length > 1 && (
                                                    <Select
                                                        aria-label={`Copiar programação para ${column.title}`}
                                                        value=""
                                                        disabled={busy}
                                                        onChange={(e) => e.target.value && copyFrom(column, e.target.value)}
                                                        style={{ padding: '0.3rem 0.5rem' }}
                                                    >
                                                        <option value="">Copiar de…</option>
                                                        {columns.filter((c) => c.key !== column.key && dayBlocks(c.groupId).length > 0).map((c) => (
                                                            <option key={c.key} value={c.key}>{c.title}</option>
                                                        ))}
                                                    </Select>
                                                )}
                                            </div>
                                        )}
                                    </ColumnHeader>

                                    <div>
                                        {list.map((block, index) => {
                                            const activity = activityById.get(block.activityId);
                                            if (!activity) return null;
                                            const fixedRoom = activity.kind === 'ACTIVITY' ? activity.room : null;
                                            return (
                                                <BlockRow
                                                    key={block.id}
                                                    $kind={activity.kind}
                                                    $warn={conflictBlockIds.has(block.id)}
                                                    title={conflictBlockIds.has(block.id) ? 'Em conflito: veja os avisos acima' : undefined}
                                                >
                                                    <Time>{block.startTime}–{block.endTime}</Time>
                                                    <BlockInfo>
                                                        <strong>{activity.title}</strong>
                                                        {(fixedRoom || assigneeNames(activity)) && (
                                                            <Muted>
                                                                {fixedRoom && <><MapPin size={11} style={{ verticalAlign: '-1px' }} /> {fixedRoom.name}{assigneeNames(activity) ? ' · ' : ''}</>}
                                                                {assigneeNames(activity)}
                                                            </Muted>
                                                        )}
                                                    </BlockInfo>
                                                    {canManage ? (
                                                        <div style={{ display: 'flex' }}>
                                                            <IconButton type="button" aria-label="Subir" disabled={busy || index === 0} onClick={() => move(column, index, -1)}>
                                                                <ArrowUp size={14} />
                                                            </IconButton>
                                                            <IconButton type="button" aria-label="Descer" disabled={busy || index === list.length - 1} onClick={() => move(column, index, 1)}>
                                                                <ArrowDown size={14} />
                                                            </IconButton>
                                                            <IconButton
                                                                type="button"
                                                                aria-label={`Tirar ${activity.title}`}
                                                                disabled={busy}
                                                                onClick={() => save(column, idsOf(list).filter((_, i) => i !== index))}
                                                            >
                                                                <X size={14} />
                                                            </IconButton>
                                                        </div>
                                                    ) : (
                                                        <span />
                                                    )}
                                                </BlockRow>
                                            );
                                        })}
                                        {list.length === 0 && (
                                            <HelpText as="p" style={{ padding: '0.75rem', margin: 0 }}>
                                                {canManage ? 'Nada programado neste dia. Adicione atividades abaixo ou copie de outro grupo.' : 'Nada programado neste dia.'}
                                            </HelpText>
                                        )}
                                    </div>

                                    {canManage && (
                                        <ColumnFooter>
                                            <Select
                                                aria-label={`Adicionar atividade — ${column.title}`}
                                                value=""
                                                disabled={busy}
                                                onChange={(e) => e.target.value && save(column, [...idsOf(list), e.target.value])}
                                            >
                                                <option value="">+ Adicionar atividade…</option>
                                                <optgroup label="Atividades">
                                                    {activities.filter((a) => a.kind === 'ACTIVITY').map((a) => (
                                                        <option key={a.id} value={a.id}>
                                                            {usedIds.has(a.id) ? '✓ ' : ''}{a.title} ({a.durationMinutes} min)
                                                        </option>
                                                    ))}
                                                </optgroup>
                                                <optgroup label="Intervalos e refeições">
                                                    {activities.filter((a) => a.kind !== 'ACTIVITY').map((a) => (
                                                        <option key={a.id} value={a.id}>{a.title} ({a.durationMinutes} min)</option>
                                                    ))}
                                                </optgroup>
                                            </Select>
                                            {list.length > 0 && <Muted>Termina às {list[list.length - 1].endTime}</Muted>}
                                            {missing.length > 0 && (
                                                <Muted style={{ color: '#9a6b00' }}>
                                                    Ainda não programadas para {column.title}: {missing.map((a) => a.title).join(', ')}.
                                                </Muted>
                                            )}
                                        </ColumnFooter>
                                    )}
                                </Column>
                            );
                        })}
                    </Columns>
                )}
                {canManage && (
                    <HelpText as="p" style={{ marginTop: '0.6rem' }}>
                        A chamada é feita por período: cada trecho entre refeições (manhã, tarde) vira um período na aba Agenda, com a lista de alunos do grupo.
                    </HelpText>
                )}
            </Section>

            {canManage && (
                <>
                    <GroupModal courseId={courseId} group={groupModal.group} open={groupModal.open} onOpenChange={(open) => setGroupModal((m) => ({ ...m, open }))} />
                    <ActivityModal courseId={courseId} activity={activityModal.activity} open={activityModal.open} onOpenChange={(open) => setActivityModal((m) => ({ ...m, open }))} />
                    <SaveTemplateModal courseId={courseId} defaultName={courseTitle} open={saveTemplateOpen} onOpenChange={setSaveTemplateOpen} />
                    <ApplyTemplateModal courseId={courseId} defaultDate={toDateOnly(courseStartDate)} open={applyTemplateOpen} onOpenChange={setApplyTemplateOpen} />
                </>
            )}
        </div>
    );
}
