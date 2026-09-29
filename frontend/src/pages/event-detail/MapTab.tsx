// frontend/src/pages/event-detail/MapTab.tsx
//
// Mapa do evento: planta baixa + postos. A tela mostra UM turno por vez (ou o resumo do dia), com
// os nomes de quem está em cada posto direto no mapa. O PNG baixado e a impressão (uma folha por
// turno) usam a mesma folha (MapSheet), então saem exatamente como aparecem na tela.
//
// Editar (posicionar/arrastar/renomear/remover postos, trocar a planta, gerir turnos) exige
// `events:manage`; quem só pode ver o evento vê o mapa somente leitura.

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import * as Popover from '@radix-ui/react-popover';
import styled from 'styled-components';
import html2canvas from 'html2canvas';
import { useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { MapPin, Upload, Download, Printer, X, Clock } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Field, Label, Input, HelpText, Form, FormActions, CheckboxField } from '@/components/ui/FormField';
import { EmptyState } from '@/components/ui/Table';
import { eventPostsApi, type EventPost } from '@/services/events';
import { mediaApi } from '@/services/media';
import { toast } from '@/utils/toast';
import { apiErrorMessage } from '@/utils/apiError';
import { allShiftIds, type Schedule } from '@/utils/schedule';
import { FilterChip } from '@/pages/course-detail/styles';
import { useEventSchedule } from './useEventSchedule';
import { MapSheet, type MapPinData } from './MapSheet';
import { SheetHeader, SheetFooter } from './SheetParts';
import { ShiftPicker } from './ShiftPicker';
import { ShiftsManager } from './ShiftsManager';
import { PrintPortal } from './PrintPortal';
import { waitForImages } from '@/utils/dom';
import { buildPins, findShiftBlock, type MapSelection } from './mapPins';

const UploadBox = styled.label`
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 3rem 1rem;
    border: 2px dashed ${({ theme }) => theme.colors.borderLight};
    border-radius: ${({ theme }) => theme.radii.md};
    color: ${({ theme }) => theme.colors.textMuted};
    font-size: 0.8125rem;
    cursor: pointer;

    &:hover {
        border-color: ${({ theme }) => theme.colors.primary};
    }

    input {
        display: none;
    }
`;

const Bar = styled.div`
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.5rem 1rem;
    margin-bottom: 0.6rem;
`;

const Chips = styled.div`
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.4rem;
`;

const PostPopover = styled(Popover.Content)`
    width: 270px;
    background: ${({ theme }) => theme.colors.white};
    border-radius: ${({ theme }) => theme.radii.md};
    box-shadow: ${({ theme }) => theme.shadows.e3};
    border: 1px solid ${({ theme }) => theme.colors.borderLight};
    padding: 0.75rem;
    font-size: 0.8125rem;
    z-index: 200;
`;

const PRINT_WIDTH = 1040; // ≈ largura útil de uma A4 paisagem com margem de 8 mm (96 dpi)
const PRINT_MAP_MAX_HEIGHT = 630; // A4 paisagem (≈734 px úteis) menos cabeçalho e rodapé da folha
const PNG_WIDTH = 1400;

function currentShiftId(schedule: Schedule): string | null {
    const now = Date.now();
    const all = schedule.days.flatMap((d) => d.shifts);
    return (all.find((s) => +new Date(s.shift.start) <= now && now < +new Date(s.shift.end)) ?? all[0])?.shift.id ?? null;
}

export function MapTab({ eventId, canManage }: { eventId: string; canManage: boolean }) {
    const queryClient = useQueryClient();
    const { event, shifts, posts, schedule } = useEventSchedule(eventId);

    const [selection, setSelection] = useState<MapSelection | null>(null);
    const [showNames, setShowNames] = useState(true);
    const [showRoles, setShowRoles] = useState(false);
    const [isPlacing, setIsPlacing] = useState(false);
    const [pendingPos, setPendingPos] = useState<{ x: number; y: number } | null>(null);
    const [dragging, setDragging] = useState<{ id: string; x: number; y: number } | null>(null);
    const [shiftsOpen, setShiftsOpen] = useState(false);
    const [printOpen, setPrintOpen] = useState(false);
    const [printIds, setPrintIds] = useState<string[]>([]);
    const [printing, setPrinting] = useState(false);
    const [png, setPng] = useState<MapSelection | null>(null);

    const canvasRef = useRef<HTMLDivElement>(null);
    const pngRef = useRef<HTMLDivElement>(null);
    const draggedRef = useRef(false);
    const { register, handleSubmit, reset } = useForm<{ name: string; capacity: string }>();

    const floorPlanUrl = event?.operation?.floorPlanUrl;

    const effective: MapSelection | null = useMemo(() => {
        if (selection) {
            const stillValid = selection.kind === 'day' ? schedule.days.some((d) => d.key === selection.dayKey) : Boolean(findShiftBlock(schedule, selection.shiftId));
            if (stillValid) return selection;
        }
        const id = currentShiftId(schedule);
        return id ? { kind: 'shift', shiftId: id } : null;
    }, [selection, schedule]);

    const selectedDay = useMemo(() => {
        if (!effective) return schedule.days[0];
        if (effective.kind === 'day') return schedule.days.find((d) => d.key === effective.dayKey);
        return schedule.days.find((d) => d.shifts.some((s) => s.shift.id === effective.shiftId));
    }, [effective, schedule]);

    const pins = useMemo(() => buildPins(posts, schedule, effective, { showRoles }), [posts, schedule, effective, showRoles]);

    const invalidateEvent = () => queryClient.invalidateQueries({ queryKey: ['events', eventId] });

    const uploadMutation = useMutation({
        mutationFn: async (file: File) => {
            const { storageKey, fileUrl } = await mediaApi.upload(file, 'event-floor-plan');
            return eventPostsApi.setFloorPlan(eventId, { floorPlanKey: storageKey, floorPlanUrl: fileUrl });
        },
        onSuccess: () => { toast.success('Planta baixa atualizada.'); invalidateEvent(); },
        onError: (error: unknown) => toast.error(apiErrorMessage(error, 'Não foi possível enviar a planta baixa.')),
    });

    const createPostMutation = useMutation({
        mutationFn: (input: { name: string; capacity?: number; posX: number; posY: number }) => eventPostsApi.create(eventId, input),
        onSuccess: () => { toast.success('Posto adicionado.'); invalidateEvent(); setPendingPos(null); setIsPlacing(false); },
        onError: (error: unknown) => toast.error(apiErrorMessage(error, 'Não foi possível criar o posto.')),
    });

    const movePostMutation = useMutation({
        mutationFn: ({ postId, posX, posY }: { postId: string; posX: number; posY: number }) => eventPostsApi.update(eventId, postId, { posX, posY }),
        onSuccess: async () => { await invalidateEvent(); setDragging(null); },
        onError: async (error: unknown) => {
            toast.error(apiErrorMessage(error, 'Não foi possível mover o posto.'));
            await invalidateEvent();
            setDragging(null);
        },
    });

    const clamp = (v: number) => Math.min(1, Math.max(0, v));
    const relativePos = (clientX: number, clientY: number) => {
        const rect = canvasRef.current!.getBoundingClientRect();
        return { x: clamp((clientX - rect.left) / rect.width), y: clamp((clientY - rect.top) / rect.height) };
    };

    /** Arrastar reposiciona (persiste ao soltar); um clique sem arrastar abre os detalhes do posto. */
    const handlePinPointerDown = (e: React.PointerEvent<HTMLButtonElement>, pin: MapPinData) => {
        if (isPlacing || !canManage) return;
        e.stopPropagation();
        draggedRef.current = false;
        const onMove = (ev: PointerEvent) => {
            draggedRef.current = true;
            setDragging({ id: pin.id, ...relativePos(ev.clientX, ev.clientY) });
        };
        const onUp = (ev: PointerEvent) => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
            if (draggedRef.current) {
                const final = relativePos(ev.clientX, ev.clientY);
                setDragging({ id: pin.id, ...final });
                movePostMutation.mutate({ postId: pin.id, posX: final.x, posY: final.y });
            } else {
                setDragging(null);
            }
        };
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
    };

    const handlePinClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (draggedRef.current) {
            e.preventDefault(); // encerrou um arrasto: não abre o popover
            draggedRef.current = false;
        }
    };

    const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!isPlacing) return;
        const rect = e.currentTarget.getBoundingClientRect();
        setPendingPos({ x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height });
    };

    /* ------------------------------ PNG (folha offscreen, largura fixa) ------------------------------ */
    useEffect(() => {
        if (!png) return;
        let cancelled = false;
        (async () => {
            const el = pngRef.current;
            if (!el) return;
            await waitForImages(el);
            try {
                const canvas = await html2canvas(el, { useCORS: true, backgroundColor: '#ffffff' });
                const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
                if (!blob) throw new Error('sem imagem');
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                const label = png.kind === 'shift' ? findShiftBlock(schedule, png.shiftId)?.shift.name : 'dia';
                link.href = url;
                link.download = `mapa-${event?.title ?? 'evento'}-${selectedDay?.key ?? ''}-${label ?? ''}.png`.replace(/\s+/g, '-');
                link.click();
                URL.revokeObjectURL(url);
            } catch {
                if (!cancelled) toast.error('Não foi possível gerar a imagem do mapa — verifique se a planta baixa permite acesso de outra origem (CORS).');
            } finally {
                if (!cancelled) setPng(null);
            }
        })();
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [png]);

    const sheetTitle = (selection: MapSelection | null) => {
        if (!selection) return { dayLabel: '', shiftLabel: 'Postos' };
        if (selection.kind === 'day') {
            const day = schedule.days.find((d) => d.key === selection.dayKey);
            return { dayLabel: day?.label ?? '', shiftLabel: 'Todos os turnos do dia' };
        }
        const day = schedule.days.find((d) => d.shifts.some((s) => s.shift.id === selection.shiftId));
        const block = findShiftBlock(schedule, selection.shiftId);
        return { dayLabel: day?.label ?? '', shiftLabel: block ? `${block.shift.name} · ${block.range}` : '' };
    };

    const openPrint = () => {
        setPrintIds(allShiftIds(schedule));
        setPrintOpen(true);
    };

    const printSchedule = useMemo<Schedule>(
        () => ({ days: schedule.days.map((d) => ({ ...d, shifts: d.shifts.filter((s) => printIds.includes(s.shift.id)) })).filter((d) => d.shifts.length > 0) }),
        [schedule, printIds],
    );

    /* -------------------------------------------- render -------------------------------------------- */
    if (!floorPlanUrl) {
        return canManage ? (
            <UploadBox>
                <Upload size={24} />
                {uploadMutation.isPending ? 'Enviando...' : 'Enviar imagem da planta baixa do local'}
                <input type="file" accept="image/*" disabled={uploadMutation.isPending} onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadMutation.mutate(f); }} />
            </UploadBox>
        ) : (
            <EmptyState>A planta baixa deste evento ainda não foi enviada.</EmptyState>
        );
    }

    const day = selectedDay;
    const totalPeople = day?.shifts.reduce((sum, s) => sum + s.total, 0) ?? 0;

    return (
        <div>
            {shifts.length === 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', padding: '0.6rem 0.8rem', marginBottom: '0.6rem', background: '#fff4e6', borderRadius: 8, fontSize: '0.8125rem', color: '#d9480f' }}>
                    <Clock size={16} />
                    <span>Este evento ainda não tem turnos: o mapa mostra só os postos. Crie os turnos para ver quem está em cada posto, por dia e turno.</span>
                    {canManage && <Button $variant="secondary" onClick={() => setShiftsOpen(true)}>Criar turnos</Button>}
                </div>
            )}

            <Bar>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    {schedule.days.length > 0 && (
                        <Chips role="tablist" aria-label="Dia">
                            {schedule.days.map((d) => (
                                <FilterChip
                                    key={d.key}
                                    type="button"
                                    role="tab"
                                    $active={day?.key === d.key}
                                    onClick={() => setSelection({ kind: 'shift', shiftId: d.shifts[0].shift.id })}
                                >
                                    {d.label}
                                </FilterChip>
                            ))}
                        </Chips>
                    )}
                    {day && (
                        <Chips role="tablist" aria-label="Turno">
                            {day.shifts.map((s) => (
                                <FilterChip
                                    key={s.shift.id}
                                    type="button"
                                    role="tab"
                                    $active={effective?.kind === 'shift' && effective.shiftId === s.shift.id}
                                    onClick={() => setSelection({ kind: 'shift', shiftId: s.shift.id })}
                                >
                                    {s.shift.name} {s.range} ({s.total})
                                </FilterChip>
                            ))}
                            {day.shifts.length > 1 && (
                                <FilterChip type="button" role="tab" $active={effective?.kind === 'day'} onClick={() => setSelection({ kind: 'day', dayKey: day.key })}>
                                    Dia todo
                                </FilterChip>
                            )}
                        </Chips>
                    )}
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {canManage && (
                        <>
                            <Button $variant="secondary" onClick={() => setShiftsOpen(true)}><Clock size={14} /> Turnos</Button>
                            <Button $variant={isPlacing ? 'primary' : 'secondary'} onClick={() => { setIsPlacing((v) => !v); setPendingPos(null); }}>
                                <MapPin size={14} /> {isPlacing ? 'Clique na planta para posicionar' : 'Adicionar posto'}
                            </Button>
                        </>
                    )}
                    <Button $variant="secondary" onClick={() => setPng(effective)} disabled={png !== null}>
                        <Download size={14} /> {png ? 'Gerando...' : 'Baixar imagem'}
                    </Button>
                    <Button $variant="secondary" onClick={openPrint} disabled={shifts.length === 0}>
                        <Printer size={14} /> Imprimir mapas
                    </Button>
                    {canManage && (
                        <label>
                            <Button as="span" $variant="ghost"><Upload size={14} /> Trocar planta</Button>
                            <input type="file" accept="image/*" style={{ display: 'none' }} disabled={uploadMutation.isPending} onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadMutation.mutate(f); }} />
                        </label>
                    )}
                </div>
            </Bar>

            <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.6rem', fontSize: '0.8125rem' }}>
                <CheckboxField style={{ fontWeight: 500 }}><input type="checkbox" checked={showNames} onChange={(e) => setShowNames(e.target.checked)} /> Nomes no mapa</CheckboxField>
                <CheckboxField style={{ fontWeight: 500 }}><input type="checkbox" checked={showRoles} onChange={(e) => setShowRoles(e.target.checked)} disabled={!showNames} /> Mostrar funções</CheckboxField>
                {day && <HelpText>{day.label}: {totalPeople} escalado(s) (sem recusados).</HelpText>}
                {canManage && posts.length > 0 && !isPlacing && <HelpText>Arraste um posto na planta para reposicioná-lo.</HelpText>}
            </div>

            <MapSheet
                imageUrl={floorPlanUrl}
                pins={pins}
                showNames={showNames}
                canvasRef={canvasRef}
                placing={isPlacing}
                onCanvasClick={handleCanvasClick}
                pendingPos={pendingPos}
                drag={dragging}
                onPinPointerDown={canManage ? handlePinPointerDown : undefined}
                onPinClick={handlePinClick}
                renderPin={(pin, node) => (
                    <Popover.Root>
                        <Popover.Trigger asChild>{node}</Popover.Trigger>
                        <Popover.Portal>
                            <PostPopover side="top" sideOffset={8}>
                                <PostDetails
                                    pin={pin}
                                    post={posts.find((p) => p.id === pin.id)}
                                    canManage={canManage}
                                    onChanged={invalidateEvent}
                                    eventId={eventId}
                                />
                            </PostPopover>
                        </Popover.Portal>
                    </Popover.Root>
                )}
            />

            {posts.length === 0 && <EmptyState>Nenhum posto cadastrado ainda{canManage ? ' — clique em "Adicionar posto" e depois na planta.' : '.'}</EmptyState>}

            {/* Novo posto */}
            <Modal open={pendingPos !== null} onOpenChange={(open) => { if (!open) setPendingPos(null); }} title="Novo posto de atuação">
                <Form
                    onSubmit={handleSubmit((data) => {
                        if (!pendingPos) return;
                        createPostMutation.mutate({ name: data.name, capacity: data.capacity ? Number(data.capacity) : undefined, posX: pendingPos.x, posY: pendingPos.y });
                        reset();
                    })}
                >
                    <Field>
                        <Label htmlFor="post-name">Nome do posto</Label>
                        <Input id="post-name" placeholder="ex: Portão A, Palco, Enfermaria" {...register('name', { required: true })} />
                    </Field>
                    <Field>
                        <Label htmlFor="post-capacity">Quantas pessoas o posto precisa (opcional)</Label>
                        <Input id="post-capacity" type="number" min={1} {...register('capacity')} />
                        <HelpText>Usado para mostrar se o posto está completo, parcial ou vazio em cada turno.</HelpText>
                    </Field>
                    <FormActions>
                        <Button type="button" $variant="secondary" onClick={() => setPendingPos(null)}>Cancelar</Button>
                        <Button type="submit" disabled={createPostMutation.isPending}>{createPostMutation.isPending ? 'Salvando...' : 'Adicionar'}</Button>
                    </FormActions>
                </Form>
            </Modal>

            {canManage && event && (
                <ShiftsManager eventId={eventId} eventStart={event.startDate} eventEnd={event.endDate} shifts={shifts} open={shiftsOpen} onOpenChange={setShiftsOpen} />
            )}

            {/* Escolher o que imprimir */}
            <Modal open={printOpen} onOpenChange={setPrintOpen} title="Imprimir mapas" width="560px">
                <Form onSubmit={(e) => { e.preventDefault(); setPrintOpen(false); setPrinting(true); }}>
                    <HelpText>Uma folha (A4 paisagem) por turno, com o mapa e os nomes de cada posto. Cada folha traz o dia, o turno e a hora em que foi gerada.</HelpText>
                    <ShiftPicker days={schedule.days} value={printIds} onChange={setPrintIds} showCounts />
                    <FormActions>
                        <Button type="button" $variant="secondary" onClick={() => setPrintOpen(false)}>Cancelar</Button>
                        <Button type="submit" disabled={printIds.length === 0}>Imprimir {printIds.length} folha(s)</Button>
                    </FormActions>
                </Form>
            </Modal>

            {printing && (
                <PrintPortal active={printing} onFinished={() => setPrinting(false)}>
                    {printSchedule.days.flatMap((d) =>
                        d.shifts.map((s, index, arr) => (
                            <div key={s.shift.id} style={{ width: PRINT_WIDTH, pageBreakAfter: 'always', breakAfter: 'page', ...(index === arr.length - 1 && d === printSchedule.days[printSchedule.days.length - 1] ? { pageBreakAfter: 'auto', breakAfter: 'auto' } : {}) }}>
                                <MapSheet
                                    imageUrl={floorPlanUrl}
                                    pins={buildPins(posts, schedule, { kind: 'shift', shiftId: s.shift.id }, { showRoles })}
                                    showNames
                                    width={PRINT_WIDTH}
                                    maxHeight={PRINT_MAP_MAX_HEIGHT}
                                    header={<SheetHeader eventTitle={event?.title ?? ''} location={event?.location} dayLabel={d.label} shiftLabel={`${s.shift.name} · ${s.range}`} />}
                                    footer={<SheetFooter />}
                                />
                            </div>
                        )),
                    )}
                </PrintPortal>
            )}

            {/* Folha offscreen para o PNG (largura fixa: o mesmo desenho, independente do tamanho da tela) */}
            {png &&
                createPortal(
                    <div ref={pngRef} style={{ position: 'fixed', left: -20000, top: 0, width: PNG_WIDTH, background: '#fff', padding: 16, boxSizing: 'content-box' }}>
                        <MapSheet
                            imageUrl={floorPlanUrl}
                            pins={buildPins(posts, schedule, png, { showRoles })}
                            showNames={showNames}
                            width={PNG_WIDTH}
                            header={<SheetHeader eventTitle={event?.title ?? ''} location={event?.location} {...sheetTitle(png)} />}
                            footer={<SheetFooter />}
                        />
                    </div>,
                    document.body,
                )}
        </div>
    );
}

interface PostDetailsProps {
    pin: MapPinData;
    post?: EventPost;
    canManage: boolean;
    eventId: string;
    onChanged: () => void;
}

function PostDetails({ pin, post, canManage, eventId, onChanged }: PostDetailsProps) {
    const [name, setName] = useState(post?.name ?? pin.name);
    const [capacity, setCapacity] = useState(post?.capacity ? String(post.capacity) : '');

    const updateMutation = useMutation({
        mutationFn: () => eventPostsApi.update(eventId, pin.id, { name: name.trim(), capacity: capacity ? Number(capacity) : undefined }),
        onSuccess: () => { toast.success('Posto atualizado.'); onChanged(); },
        onError: (error: unknown) => toast.error(apiErrorMessage(error, 'Não foi possível atualizar o posto.')),
    });

    const removeMutation = useMutation({
        mutationFn: () => eventPostsApi.remove(eventId, pin.id),
        onSuccess: () => { toast.success('Posto removido.'); onChanged(); },
        onError: (error: unknown) => toast.error(apiErrorMessage(error, 'Não foi possível remover o posto.')),
    });

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <strong>{pin.name}</strong>
                {canManage && (
                    <button
                        type="button"
                        aria-label="Remover posto"
                        title="Remover posto (as pessoas escaladas nele ficam sem posto)"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.6 }}
                        onClick={() => { if (window.confirm(`Remover o posto "${pin.name}"? As pessoas escaladas nele ficarão sem posto.`)) removeMutation.mutate(); }}
                    >
                        <X size={14} />
                    </button>
                )}
            </div>

            <div style={{ fontSize: '0.75rem' }}>
                {pin.lines.map((line, i) => (
                    <div key={i} style={{ color: line.warn ? '#d9480f' : line.pending ? '#868e96' : undefined }}>
                        {line.text}{line.pending ? ' (pendente)' : ''}
                    </div>
                ))}
            </div>

            {canManage && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', borderTop: '1px solid #dee2e6', paddingTop: '0.5rem' }}>
                    <Input aria-label="Nome do posto" value={name} onChange={(e) => setName(e.target.value)} style={{ padding: '0.3rem 0.5rem' }} />
                    <Input aria-label="Pessoas necessárias" type="number" min={1} placeholder="Pessoas necessárias" value={capacity} onChange={(e) => setCapacity(e.target.value)} style={{ padding: '0.3rem 0.5rem' }} />
                    <Button type="button" $variant="secondary" disabled={!name.trim() || updateMutation.isPending} onClick={() => updateMutation.mutate()}>
                        Salvar posto
                    </Button>
                </div>
            )}
        </div>
    );
}
