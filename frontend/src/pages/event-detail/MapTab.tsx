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
import { MapPin, Upload, Download, Printer, X, Clock, Share2, ChevronDown, Eye, Layers, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ActionMenu, MoreButton } from '@/components/ui/ActionMenu';
import { Modal } from '@/components/ui/Modal';
import { Field, Label, Input, HelpText, Form, FormActions } from '@/components/ui/FormField';
import { EmptyState } from '@/components/ui/Table';
import { eventFloorPlansApi, eventPostsApi, type EventFloorPlan, type EventPost } from '@/services/events';
import { mediaApi } from '@/services/media';
import { toast } from '@/utils/toast';
import { apiErrorMessage } from '@/utils/apiError';
import { allShiftIds, hasMultiplePlans, type Schedule } from '@/utils/schedule';
import { FilterChip } from '@/pages/course-detail/styles';
import { useEventSchedule } from './useEventSchedule';
import { MapSheet, type MapPinData } from './MapSheet';
import { SheetHeader, SheetFooter } from './SheetParts';
import { ShiftPicker } from './ShiftPicker';
import { ShiftsManager } from './ShiftsManager';
import { FloorPlansManager } from './FloorPlansManager';
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

/** Nome de arquivo seguro: sem acentos nem caracteres especiais (alguns navegadores/sistemas os recusam). */
const slug = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '');

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
    const { event, shifts, posts, floorPlans, schedule } = useEventSchedule(eventId);

    const [selection, setSelection] = useState<MapSelection | null>(null);
    const [showNames, setShowNames] = useState(true);
    const [showRoles, setShowRoles] = useState(false);
    const [isPlacing, setIsPlacing] = useState(false);
    const [pendingPos, setPendingPos] = useState<{ x: number; y: number } | null>(null);
    const [dragging, setDragging] = useState<{ id: string; x: number; y: number } | null>(null);
    const [shiftsOpen, setShiftsOpen] = useState(false);
    const [printOpen, setPrintOpen] = useState(false);
    const [printIds, setPrintIds] = useState<string[]>([]);
    const [printPlanIds, setPrintPlanIds] = useState<string[]>([]);
    const [printing, setPrinting] = useState(false);
    const [png, setPng] = useState<{ selection: MapSelection | null; plan: EventFloorPlan } | null>(null);
    const [planId, setPlanId] = useState<string | null>(null);
    const [plansOpen, setPlansOpen] = useState(false);

    const canvasRef = useRef<HTMLDivElement>(null);
    const pngRef = useRef<HTMLDivElement>(null);
    const draggedRef = useRef(false);
    const { register, handleSubmit, reset } = useForm<{ name: string; capacity: string }>();

    const multiPlan = hasMultiplePlans(schedule);
    const currentPlan = floorPlans.find((p) => p.id === planId) ?? floorPlans[0] ?? null;
    /** Postos de uma planta. Com uma planta só, postos antigos sem planta ainda aparecem nela. */
    const postsOf = (plan: EventFloorPlan) => posts.filter((p) => p.floorPlanId === plan.id || (floorPlans.length === 1 && p.floorPlanId == null));

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

    const pins = useMemo(
        () => buildPins(currentPlan ? postsOf(currentPlan) : [], schedule, effective, { showRoles }),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [posts, floorPlans, currentPlan?.id, schedule, effective, showRoles],
    );
    /** Postos sem ninguém no turno escolhido, por planta: aparece na aba para não esconder um buraco em outra planta. */
    const emptyByPlan = useMemo(
        () => Object.fromEntries(floorPlans.map((plan) => [plan.id, buildPins(postsOf(plan), schedule, effective, { showRoles: false }).filter((pin) => pin.state === 'empty').length])),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [posts, floorPlans, schedule, effective],
    );

    const invalidateEvent = () => queryClient.invalidateQueries({ queryKey: ['events', eventId] });

    const uploadMutation = useMutation({
        mutationFn: async (file: File) => {
            const { storageKey, fileUrl } = await mediaApi.upload(file, 'event-floor-plan');
            return eventFloorPlansApi.create(eventId, { imageKey: storageKey, imageUrl: fileUrl });
        },
        onSuccess: () => { toast.success('Planta baixa enviada.'); invalidateEvent(); },
        onError: (error: unknown) => toast.error(apiErrorMessage(error, 'Não foi possível enviar a planta baixa.')),
    });

    const createPostMutation = useMutation({
        mutationFn: (input: { name: string; capacity?: number; posX: number; posY: number; floorPlanId: string }) => eventPostsApi.create(eventId, input),
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
                const label = png.selection?.kind === 'shift' ? findShiftBlock(schedule, png.selection.shiftId)?.shift.name : 'dia';
                link.href = url;
                link.download = ['mapa', slug(event?.title ?? 'evento'), multiPlan ? slug(png.plan.name) : '', selectedDay?.key ?? '', slug(label ?? '')].filter(Boolean).join('-') + '.png';
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
        return { dayLabel: day?.label ?? '', shiftLabel: block ? block.title : '' };
    };

    const openPrint = () => {
        setPrintIds(allShiftIds(schedule));
        setPrintPlanIds(floorPlans.map((p) => p.id));
        setPrintOpen(true);
    };

    const printSchedule = useMemo<Schedule>(
        () => ({ plans: schedule.plans, days: schedule.days.map((d) => ({ ...d, shifts: d.shifts.filter((s) => printIds.includes(s.shift.id)) })).filter((d) => d.shifts.length > 0) }),
        [schedule, printIds],
    );
    const printPlans = floorPlans.filter((p) => printPlanIds.includes(p.id));
    const printSheets = printIds.length * printPlans.length;

    /* -------------------------------------------- render -------------------------------------------- */
    if (!currentPlan) {
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
    const floorPlanUrl = currentPlan.imageUrl;
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
                    {multiPlan && (
                        <Chips role="tablist" aria-label="Planta">
                            {floorPlans.map((plan) => (
                                <FilterChip key={plan.id} type="button" role="tab" $active={currentPlan.id === plan.id} onClick={() => { setPlanId(plan.id); setPendingPos(null); }}>
                                    <Layers size={12} style={{ marginRight: 4, verticalAlign: -1 }} />
                                    {plan.name}
                                    {emptyByPlan[plan.id] > 0 && (
                                        <span title={`${emptyByPlan[plan.id]} posto(s) sem ninguém neste turno`} style={{ marginLeft: 6, color: '#d9480f', fontWeight: 700 }}>
                                            <AlertTriangle size={12} style={{ verticalAlign: -1 }} /> {emptyByPlan[plan.id]}
                                        </span>
                                    )}
                                </FilterChip>
                            ))}
                        </Chips>
                    )}
                    {schedule.days.length > 1 && (
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
                                    {s.title} ({s.total})
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

                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    {canManage && (
                        <Button $variant={isPlacing ? 'primary' : 'secondary'} onClick={() => { setIsPlacing((v) => !v); setPendingPos(null); }}>
                            <MapPin size={14} /> {isPlacing ? 'Clique na planta para posicionar' : 'Adicionar posto'}
                        </Button>
                    )}
                    <ActionMenu
                        trigger={<Button $variant="secondary"><Share2 size={14} /> Exportar <ChevronDown size={14} /></Button>}
                        entries={[
                            { label: png ? 'Gerando imagem…' : 'Baixar imagem (PNG)', icon: <Download size={14} />, hint: 'o que está na tela', disabled: png !== null, onSelect: () => setPng({ selection: effective, plan: currentPlan }) },
                            { label: 'Imprimir mapas', icon: <Printer size={14} />, hint: multiPlan ? 'uma folha por turno e planta' : 'uma folha por turno', disabled: shifts.length === 0, onSelect: openPrint },
                        ]}
                    />
                    <ActionMenu
                        trigger={<Button $variant="ghost"><Eye size={14} /> Exibir <ChevronDown size={14} /></Button>}
                        entries={[
                            { type: 'check', label: 'Nomes no mapa', checked: showNames, onCheckedChange: setShowNames },
                            { type: 'check', label: 'Mostrar funções', checked: showRoles, disabled: !showNames, onCheckedChange: setShowRoles },
                        ]}
                    />
                    {canManage && (
                        <ActionMenu
                            trigger={<MoreButton label="Mais opções do mapa" />}
                            entries={[
                                { label: 'Gerenciar turnos', icon: <Clock size={14} />, onSelect: () => setShiftsOpen(true) },
                                { label: multiPlan ? 'Gerenciar plantas' : 'Plantas do evento', icon: <Layers size={14} />, hint: `${floorPlans.length}/10`, onSelect: () => setPlansOpen(true) },
                            ]}
                        />
                    )}
                </div>
            </Bar>

            <div style={{ marginBottom: '0.6rem' }}>
                <HelpText>
                    {day ? `${day.label}: ${totalPeople} escalado(s), sem contar quem recusou.` : ''}
                    {canManage && posts.length > 0 && !isPlacing ? ' Arraste um posto na planta para reposicioná-lo.' : ''}
                </HelpText>
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
                                    plans={floorPlans}
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
            <Modal open={pendingPos !== null} onOpenChange={(open) => { if (!open) setPendingPos(null); }} title={multiPlan ? `Novo posto — ${currentPlan.name}` : 'Novo posto de atuação'}>
                <Form
                    onSubmit={handleSubmit((data) => {
                        if (!pendingPos) return;
                        createPostMutation.mutate({ name: data.name, capacity: data.capacity ? Number(data.capacity) : undefined, posX: pendingPos.x, posY: pendingPos.y, floorPlanId: currentPlan.id });
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

            {canManage && (
                <FloorPlansManager
                    eventId={eventId}
                    plans={floorPlans}
                    open={plansOpen}
                    onOpenChange={setPlansOpen}
                    onChanged={invalidateEvent}
                />
            )}

            {canManage && event && (
                <ShiftsManager eventId={eventId} eventStart={event.startDate} eventEnd={event.endDate} shifts={shifts} open={shiftsOpen} onOpenChange={setShiftsOpen} />
            )}

            {/* Escolher o que imprimir */}
            <Modal open={printOpen} onOpenChange={setPrintOpen} title="Imprimir mapas" width="560px">
                <Form onSubmit={(e) => { e.preventDefault(); setPrintOpen(false); setPrinting(true); }}>
                    <HelpText>
                        Uma folha (A4 paisagem) por turno{multiPlan ? ' e por planta' : ''}, com o mapa e os nomes de cada posto. Cada folha traz o dia, o turno{multiPlan ? ', a planta' : ''} e a hora em que foi gerada.
                    </HelpText>
                    {multiPlan && (
                        <Chips aria-label="Plantas a imprimir">
                            {floorPlans.map((plan) => (
                                <FilterChip
                                    key={plan.id}
                                    type="button"
                                    $active={printPlanIds.includes(plan.id)}
                                    onClick={() => setPrintPlanIds((ids) => (ids.includes(plan.id) ? ids.filter((id) => id !== plan.id) : [...ids, plan.id]))}
                                >
                                    {plan.name}
                                </FilterChip>
                            ))}
                        </Chips>
                    )}
                    <ShiftPicker days={schedule.days} value={printIds} onChange={setPrintIds} showCounts />
                    <FormActions>
                        <Button type="button" $variant="secondary" onClick={() => setPrintOpen(false)}>Cancelar</Button>
                        <Button type="submit" disabled={printSheets === 0}>Imprimir {printSheets} folha(s)</Button>
                    </FormActions>
                </Form>
            </Modal>

            {printing && (
                <PrintPortal active={printing} onFinished={() => setPrinting(false)}>
                    {(() => {
                        const sheets = printSchedule.days.flatMap((d) => d.shifts.flatMap((s) => printPlans.map((plan) => ({ d, s, plan }))));
                        return sheets.map(({ d, s, plan }, index) => (
                            <div key={`${s.shift.id}-${plan.id}`} style={{ width: PRINT_WIDTH, pageBreakAfter: index === sheets.length - 1 ? 'auto' : 'always', breakAfter: index === sheets.length - 1 ? 'auto' : 'page' }}>
                                <MapSheet
                                    imageUrl={plan.imageUrl}
                                    pins={buildPins(postsOf(plan), schedule, { kind: 'shift', shiftId: s.shift.id }, { showRoles })}
                                    showNames
                                    width={PRINT_WIDTH}
                                    maxHeight={PRINT_MAP_MAX_HEIGHT}
                                    header={<SheetHeader eventTitle={event?.title ?? ''} location={event?.location} dayLabel={d.label} shiftLabel={s.title} planName={multiPlan ? plan.name : null} />}
                                    footer={<SheetFooter />}
                                />
                            </div>
                        ));
                    })()}
                </PrintPortal>
            )}

            {/* Folha offscreen para o PNG (largura fixa: o mesmo desenho, independente do tamanho da tela) */}
            {png &&
                createPortal(
                    <div ref={pngRef} style={{ position: 'fixed', left: -20000, top: 0, width: PNG_WIDTH, background: '#fff', padding: 16, boxSizing: 'content-box' }}>
                        <MapSheet
                            imageUrl={png.plan.imageUrl}
                            pins={buildPins(postsOf(png.plan), schedule, png.selection, { showRoles })}
                            showNames={showNames}
                            width={PNG_WIDTH}
                            header={<SheetHeader eventTitle={event?.title ?? ''} location={event?.location} {...sheetTitle(png.selection)} planName={multiPlan ? png.plan.name : null} />}
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
    plans: EventFloorPlan[];
    canManage: boolean;
    eventId: string;
    onChanged: () => void;
}

function PostDetails({ pin, post, plans, canManage, eventId, onChanged }: PostDetailsProps) {
    const [name, setName] = useState(post?.name ?? pin.name);
    const [capacity, setCapacity] = useState(post?.capacity ? String(post.capacity) : '');

    const updateMutation = useMutation({
        mutationFn: () => eventPostsApi.update(eventId, pin.id, { name: name.trim(), capacity: capacity ? Number(capacity) : undefined }),
        onSuccess: () => { toast.success('Posto atualizado.'); onChanged(); },
        onError: (error: unknown) => toast.error(apiErrorMessage(error, 'Não foi possível atualizar o posto.')),
    });

    const moveMutation = useMutation({
        mutationFn: (floorPlanId: string) => eventPostsApi.update(eventId, pin.id, { floorPlanId }),
        onSuccess: () => { toast.success('Posto movido. Ele apareceu no centro da outra planta: arraste para o lugar certo.'); onChanged(); },
        onError: (error: unknown) => toast.error(apiErrorMessage(error, 'Não foi possível mover o posto.')),
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
                    {plans.length > 1 && (
                        <select
                            aria-label="Mover para outra planta"
                            value=""
                            disabled={moveMutation.isPending}
                            onChange={(e) => { if (e.target.value) moveMutation.mutate(e.target.value); }}
                            style={{ padding: '0.3rem 0.5rem', fontSize: '0.8125rem' }}
                        >
                            <option value="">Mover para outra planta…</option>
                            {plans.filter((p) => p.id !== post?.floorPlanId).map((p) => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                    )}
                </div>
            )}
        </div>
    );
}
