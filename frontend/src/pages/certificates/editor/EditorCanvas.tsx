// frontend/src/pages/certificates/editor/EditorCanvas.tsx
//
// A folha do certificado no editor: desenha os elementos (ElementView), seleciona,
// arrasta com guias magnéticas (bordas e centros da página e dos outros elementos)
// e redimensiona pelas alças. Coordenadas do layout em pontos; na tela, pontos ×
// escala. Alt durante o arrasto desliga as guias; Shift nas alças de canto mantém
// a proporção.

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import styled from 'styled-components';
import { PAGE_SIZE, type CertificateLayout, type LayoutElement } from '../layout/types';
import { ElementView, type RenderContext } from './ElementView';
import { resolveColor } from './layoutUtils';

const Viewport = styled.div`
    position: relative;
    flex: 1;
    min-width: 0;
    min-height: 0;
    overflow: auto;
    background: #e2e8f0;
    background-image: radial-gradient(#cbd5e1 1px, transparent 1px);
    background-size: 16px 16px;
    display: flex;
    padding: 24px;
`;

const Page = styled.div`
    position: relative;
    margin: auto;
    flex-shrink: 0;
    box-shadow: 0 10px 30px rgba(15, 23, 42, 0.18);
    touch-action: none;
    user-select: none;
`;

const Clip = styled.div`
    position: absolute;
    inset: 0;
    overflow: hidden;
`;

const Handle = styled.div<{ $cursor: string }>`
    position: absolute;
    width: 10px;
    height: 10px;
    margin: -5px 0 0 -5px;
    background: #fff;
    border: 1.5px solid #2563eb;
    border-radius: 2px;
    cursor: ${({ $cursor }) => $cursor};
    pointer-events: auto;
`;

type HandleId = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

const HANDLES: Array<{ id: HandleId; x: number; y: number; cursor: string }> = [
    { id: 'nw', x: 0, y: 0, cursor: 'nwse-resize' },
    { id: 'n', x: 0.5, y: 0, cursor: 'ns-resize' },
    { id: 'ne', x: 1, y: 0, cursor: 'nesw-resize' },
    { id: 'e', x: 1, y: 0.5, cursor: 'ew-resize' },
    { id: 'se', x: 1, y: 1, cursor: 'nwse-resize' },
    { id: 's', x: 0.5, y: 1, cursor: 'ns-resize' },
    { id: 'sw', x: 0, y: 1, cursor: 'nesw-resize' },
    { id: 'w', x: 0, y: 0.5, cursor: 'ew-resize' },
];

const MIN_SIZE = 4;
const SNAP_PX = 6;

interface Guide {
    axis: 'x' | 'y';
    at: number;
}

interface Gesture {
    kind: 'move' | 'resize';
    handle?: HandleId;
    pointerX: number;
    pointerY: number;
    start: LayoutElement;
}

interface Props {
    layout: CertificateLayout;
    ctx: Omit<RenderContext, 'scale' | 'layout'>;
    zoom: number;
    selectedId: string | null;
    onSelect: (id: string | null) => void;
    onGestureStart: () => void;
    onGestureChange: (element: LayoutElement) => void;
    onGestureEnd: () => void;
    onEditText: (id: string) => void;
}

export function EditorCanvas({ layout, ctx, zoom, selectedId, onSelect, onGestureStart, onGestureChange, onGestureEnd, onEditText }: Props) {
    const viewportRef = useRef<HTMLDivElement>(null);
    const [fitScale, setFitScale] = useState(1);
    const [guides, setGuides] = useState<Guide[]>([]);
    const [hoverId, setHoverId] = useState<string | null>(null);
    const gesture = useRef<Gesture | null>(null);
    const page = PAGE_SIZE[layout.orientation];
    const scale = fitScale * zoom;

    // Escala "caber na tela" — o zoom multiplica por cima dela.
    useEffect(() => {
        const viewport = viewportRef.current;
        if (!viewport) return;
        const observer = new ResizeObserver(() => {
            const available = { w: viewport.clientWidth - 48, h: viewport.clientHeight - 48 };
            setFitScale(Math.max(0.2, Math.min(available.w / page.width, available.h / page.height)));
        });
        observer.observe(viewport);
        return () => observer.disconnect();
    }, [page.width, page.height]);

    const renderCtx: RenderContext = { ...ctx, layout, scale };
    const selected = layout.elements.find((element) => element.id === selectedId && !element.hidden) ?? null;

    /** Aproxima as bordas/centro de `box` das guias mais próximas (página e outros elementos). */
    const snap = (box: LayoutElement, altKey: boolean): { x: number; y: number; guides: Guide[] } => {
        if (altKey) return { x: box.x, y: box.y, guides: [] };
        const threshold = SNAP_PX / scale;
        const targetsX = [0, page.width / 2, page.width];
        const targetsY = [0, page.height / 2, page.height];
        for (const other of layout.elements) {
            if (other.id === box.id || other.hidden) continue;
            targetsX.push(other.x, other.x + other.w / 2, other.x + other.w);
            targetsY.push(other.y, other.y + other.h / 2, other.y + other.h);
        }
        const best = (edges: number[], targets: number[]) => {
            let result: { delta: number; at: number } | null = null;
            for (const edge of edges) {
                for (const target of targets) {
                    const delta = target - edge;
                    if (Math.abs(delta) <= threshold && (!result || Math.abs(delta) < Math.abs(result.delta))) result = { delta, at: target };
                }
            }
            return result;
        };
        const sx = best([box.x, box.x + box.w / 2, box.x + box.w], targetsX);
        const sy = best([box.y, box.y + box.h / 2, box.y + box.h], targetsY);
        const found: Guide[] = [];
        if (sx) found.push({ axis: 'x', at: sx.at });
        if (sy) found.push({ axis: 'y', at: sy.at });
        return { x: box.x + (sx?.delta ?? 0), y: box.y + (sy?.delta ?? 0), guides: found };
    };

    const startGesture = (event: ReactPointerEvent, element: LayoutElement, kind: Gesture['kind'], handle?: HandleId) => {
        event.stopPropagation();
        onSelect(element.id);
        if (element.locked || event.button !== 0) return;
        (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
        gesture.current = { kind, handle, pointerX: event.clientX, pointerY: event.clientY, start: element };
        onGestureStart();
    };

    const moveGesture = (event: ReactPointerEvent) => {
        const g = gesture.current;
        if (!g) return;
        let dx = (event.clientX - g.pointerX) / scale;
        let dy = (event.clientY - g.pointerY) / scale;
        const start = g.start;

        if (g.kind === 'move') {
            const moved = { ...start, x: start.x + dx, y: start.y + dy };
            const snapped = snap(moved, event.altKey);
            setGuides(snapped.guides);
            onGestureChange({ ...moved, x: round(snapped.x), y: round(snapped.y) });
            return;
        }

        // Redimensionar: o arrasto é levado para o eixo do elemento quando ele está girado.
        const angle = ((start.rotation ?? 0) * Math.PI) / 180;
        if (angle) {
            const cos = Math.cos(-angle);
            const sin = Math.sin(-angle);
            [dx, dy] = [dx * cos - dy * sin, dx * sin + dy * cos];
        }
        const h = g.handle!;
        let { x, y, w, h: height } = start;
        if (h.includes('e')) w = start.w + dx;
        if (h.includes('s')) height = start.h + dy;
        if (h.includes('w')) {
            w = start.w - dx;
            x = start.x + dx;
        }
        if (h.includes('n')) {
            height = start.h - dy;
            y = start.y + dy;
        }
        // Linha (altura 0) pode continuar com altura 0; o resto tem tamanho mínimo.
        const minH = start.type === 'shape' && start.shape === 'line' ? 0 : MIN_SIZE;
        if (w < MIN_SIZE) {
            if (h.includes('w')) x -= MIN_SIZE - w;
            w = MIN_SIZE;
        }
        if (height < minH) {
            if (h.includes('n')) y -= minH - height;
            height = minH;
        }
        if (event.shiftKey && h.length === 2 && start.w > 0 && start.h > 0) {
            const ratio = start.w / start.h;
            if (w / height > ratio) w = height * ratio;
            else height = w / ratio;
            if (h.includes('w')) x = start.x + start.w - w;
            if (h.includes('n')) y = start.y + start.h - height;
        }
        setGuides([]);
        onGestureChange({ ...start, x: round(x), y: round(y), w: round(w), h: round(height) });
    };

    const endGesture = () => {
        if (!gesture.current) return;
        gesture.current = null;
        setGuides([]);
        onGestureEnd();
    };

    const boxStyle = (element: LayoutElement) => ({
        position: 'absolute' as const,
        left: element.x * scale,
        top: element.y * scale,
        width: element.w * scale,
        height: element.h * scale,
        transform: element.rotation ? `rotate(${element.rotation}deg)` : undefined,
    });

    // Linha tem altura 0: área de clique mínima para dar para pegar.
    const hitStyle = (element: LayoutElement) => {
        const style = boxStyle(element);
        if (element.h * scale < 8) return { ...style, top: style.top - 4, height: style.height + 8 };
        if (element.w * scale < 8) return { ...style, left: style.left - 4, width: style.width + 8 };
        return style;
    };

    return (
        <Viewport ref={viewportRef} onPointerDown={() => onSelect(null)}>
            <Page
                style={{ width: page.width * scale, height: page.height * scale, background: resolveColor(layout.background.color, layout) ?? '#fff' }}
                onPointerMove={moveGesture}
                onPointerUp={endGesture}
                onPointerCancel={endGesture}
                onPointerDown={(event) => {
                    event.stopPropagation();
                    onSelect(null);
                }}
            >
                <Clip>
                    {layout.background.imageUrl && (
                        <img src={layout.background.imageUrl} alt="" draggable={false} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }} />
                    )}
                    {layout.elements.map((element) =>
                        element.hidden ? null : (
                            <div key={element.id} style={{ ...boxStyle(element), opacity: element.opacity ?? 1, pointerEvents: 'none' }}>
                                <ElementView element={element} ctx={renderCtx} />
                            </div>
                        ),
                    )}
                </Clip>

                {/* Camada de interação por cima de tudo: o elemento selecionado continua pegável mesmo debaixo de outro. */}
                {layout.elements.map((element) =>
                    element.hidden ? null : (
                        <div
                            key={element.id}
                            style={{
                                ...hitStyle(element),
                                cursor: element.locked ? 'default' : 'move',
                                outline: hoverId === element.id && selectedId !== element.id ? '1px dashed #60a5fa' : undefined,
                            }}
                            onPointerEnter={() => setHoverId(element.id)}
                            onPointerLeave={() => setHoverId((current) => (current === element.id ? null : current))}
                            onPointerDown={(event) => startGesture(event, element, 'move')}
                            onDoubleClick={() => element.type === 'text' && onEditText(element.id)}
                        />
                    ),
                )}

                {selected && (
                    <div style={{ ...boxStyle(selected), outline: '1.5px solid #2563eb', pointerEvents: 'none' }}>
                        {!selected.locked &&
                            HANDLES.map((handle) => (
                                <Handle
                                    key={handle.id}
                                    $cursor={handle.cursor}
                                    style={{ left: `${handle.x * 100}%`, top: `${handle.y * 100}%` }}
                                    onPointerDown={(event) => startGesture(event, selected, 'resize', handle.id)}
                                />
                            ))}
                    </div>
                )}

                {guides.map((guide, index) =>
                    guide.axis === 'x' ? (
                        <div key={index} style={{ position: 'absolute', top: 0, bottom: 0, left: guide.at * scale, borderLeft: '1px solid #ec4899', pointerEvents: 'none' }} />
                    ) : (
                        <div key={index} style={{ position: 'absolute', left: 0, right: 0, top: guide.at * scale, borderTop: '1px solid #ec4899', pointerEvents: 'none' }} />
                    ),
                )}
            </Page>
        </Viewport>
    );
}

const round = (value: number) => Math.round(value * 10) / 10;
