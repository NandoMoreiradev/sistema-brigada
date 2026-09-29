// frontend/src/pages/event-detail/MapSheet.tsx
//
// A "folha" do mapa: planta baixa + pinos + cartões com os NOMES de quem está em cada posto naquele
// turno, posicionados sem se sobrepor (utils/schedule.ts → layoutLabels). É o mesmo componente na
// tela, no PNG baixado e na impressão — só muda a largura (`width`) e se é interativo.
//
// Todas as medidas escalam com `width / 1000`, então o cartão tem a mesma proporção em qualquer
// tamanho e a posição calculada vale para o que aparece na tela e na impressão.

import { useEffect, useMemo, useRef, useState, type ReactNode, type Ref } from 'react';
import styled from 'styled-components';
import { layoutLabels, type CoverageState } from '@/utils/schedule';
import { STATE_COLOR } from './mapColors';

export interface MapPinLine {
    text: string;
    /** Ainda não confirmou: aparece com "*" e em cinza. */
    pending?: boolean;
    /** Linha de aviso (ex.: "— vazio —"). */
    warn?: boolean;
}

export interface MapPinData {
    id: string;
    name: string;
    posX: number;
    posY: number;
    /** Texto do pino (ex.: "2/3"). */
    badge: string;
    state: CoverageState;
    lines: MapPinLine[];
}


const BASE_WIDTH = 1000;

const Wrapper = styled.div`
    position: relative;
    max-width: 100%;
`;

const Canvas = styled.div<{ $placing?: boolean }>`
    position: relative;
    overflow: hidden;
    background: #fff;
    border: 1px solid #ced4da;
    cursor: ${({ $placing }) => ($placing ? 'crosshair' : 'default')};

    img {
        display: block;
        width: 100%;
        user-select: none;
        -webkit-user-drag: none;
    }
`;

const Card = styled.div<{ $color: string; $s: number }>`
    position: absolute;
    box-sizing: border-box;
    background: #ffffff;
    border: ${({ $s }) => Math.max(1, $s)}px solid ${({ $color }) => $color};
    border-left-width: ${({ $s }) => 4 * $s}px;
    border-radius: ${({ $s }) => 4 * $s}px;
    padding: ${({ $s }) => 3 * $s}px ${({ $s }) => 6 * $s}px;
    font-size: ${({ $s }) => 11 * $s}px;
    line-height: ${({ $s }) => 14 * $s}px;
    color: #212529;
    overflow: hidden;
    pointer-events: none;

    strong {
        display: block;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        font-size: ${({ $s }) => 11.5 * $s}px;
    }

    span {
        display: block;
        white-space: normal;
        overflow-wrap: anywhere;
    }

    span.pending {
        color: #868e96;
    }

    span.warn {
        color: #d9480f;
        font-style: italic;
    }
`;

const PinButton = styled.button<{ $color: string; $s: number; $dragging?: boolean; $interactive: boolean }>`
    position: absolute;
    transform: translate(-50%, -50%);
    box-sizing: border-box;
    min-width: ${({ $s }) => 28 * $s}px;
    height: ${({ $s }) => 28 * $s}px;
    padding: 0 ${({ $s }) => 5 * $s}px;
    border-radius: 999px;
    border: ${({ $s }) => 2 * $s}px solid #fff;
    background: ${({ $color }) => $color};
    color: #fff;
    font-size: ${({ $s }) => 11 * $s}px;
    font-weight: 700;
    cursor: ${({ $interactive, $dragging }) => (!$interactive ? 'default' : $dragging ? 'grabbing' : 'grab')};
    touch-action: none;
    opacity: ${({ $dragging }) => ($dragging ? 0.85 : 1)};
    z-index: 3;
`;

const PendingPin = styled.div`
    position: absolute;
    transform: translate(-50%, -50%);
    width: 20px;
    height: 20px;
    border-radius: 50%;
    border: 2px dashed #212529;
    background: rgba(255, 255, 255, 0.6);
    z-index: 4;
`;

interface MapSheetProps {
    imageUrl: string;
    pins: MapPinData[];
    showNames: boolean;
    /** Largura fixa em px (PNG/impressão). Sem isso, acompanha a largura do contêiner. */
    width?: number;
    /** Altura máxima da planta em px (impressão): plantas altas encolhem para caber na folha. */
    maxHeight?: number;
    /** Cabeçalho/rodapé ficam DENTRO da área capturada no PNG. */
    header?: ReactNode;
    footer?: ReactNode;
    canvasRef?: Ref<HTMLDivElement>;

    // Modo de edição (aba Mapa): posicionar/arrastar postos.
    placing?: boolean;
    onCanvasClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
    pendingPos?: { x: number; y: number } | null;
    drag?: { id: string; x: number; y: number } | null;
    onPinPointerDown?: (e: React.PointerEvent<HTMLButtonElement>, pin: MapPinData) => void;
    onPinClick?: (e: React.MouseEvent) => void;
    /** Envolve o pino (ex.: num Popover com os detalhes do posto). */
    renderPin?: (pin: MapPinData, node: ReactNode) => ReactNode;
}

export function MapSheet({
    imageUrl,
    pins,
    showNames,
    width,
    maxHeight,
    header,
    footer,
    canvasRef,
    placing,
    onCanvasClick,
    pendingPos,
    drag,
    onPinPointerDown,
    onPinClick,
    renderPin,
}: MapSheetProps) {
    const wrapperRef = useRef<HTMLDivElement>(null);
    const [measured, setMeasured] = useState(0);
    const [ratio, setRatio] = useState(0.62); // altura/largura até a imagem carregar

    useEffect(() => {
        if (width || !wrapperRef.current) return;
        const el = wrapperRef.current;
        setMeasured(el.clientWidth);
        const observer = new ResizeObserver(() => setMeasured(el.clientWidth));
        observer.observe(el);
        return () => observer.disconnect();
    }, [width]);

    const fitted = width && maxHeight ? Math.min(width, Math.floor(maxHeight / ratio)) : width;
    const w = fitted ?? measured;
    const h = Math.round(w * ratio);
    const s = w / BASE_WIDTH;
    const interactive = Boolean(onPinPointerDown);

    const positioned = useMemo(
        () =>
            pins.map((pin) => {
                const dragged = drag?.id === pin.id;
                return { pin, x: (dragged ? drag.x : pin.posX) * w, y: (dragged ? drag.y : pin.posY) * h, dragged };
            }),
        [pins, drag, w, h],
    );

    const placements = useMemo(() => {
        if (!showNames || w === 0) return new Map<string, ReturnType<typeof layoutLabels>[number]>();
        const items = positioned.map(({ pin, x, y }) => {
            const lines = pin.lines.length > 0 ? pin.lines : [{ text: '—' }];
            const charW = 6.2 * s;
            const longest = Math.max(pin.name.length + 5, ...lines.map((l) => l.text.length + (l.pending ? 2 : 0)));
            const cardW = Math.min(250 * s, Math.max(104 * s, longest * charW + 16 * s));
            // Linhas longas quebram (não são cortadas): a altura estimada já conta as quebras.
            const perLine = Math.max(8, Math.floor((cardW - 16 * s) / charW));
            const wrapped = lines.reduce((sum, l) => sum + Math.max(1, Math.ceil((l.text.length + (l.pending ? 2 : 0)) / perLine)), 0);
            const cardH = (6 + 15 + wrapped * 14) * s + 4 * s;
            return { id: pin.id, px: x, py: y, w: cardW, h: cardH };
        });
        return new Map(layoutLabels(items, { width: w, height: h }, 14 * s, 6 * s).map((p) => [p.id, p]));
    }, [positioned, showNames, w, h, s]);

    return (
        <Wrapper ref={wrapperRef} style={fitted ? { width: fitted, marginInline: 'auto' } : undefined}>
            {header}
            <Canvas ref={canvasRef} $placing={placing} onClick={onCanvasClick} style={{ width: w || '100%' }}>
                <img
                    src={imageUrl}
                    alt="Planta baixa do local"
                    onLoad={(e) => {
                        const img = e.currentTarget;
                        if (img.naturalWidth > 0) setRatio(img.naturalHeight / img.naturalWidth);
                    }}
                />

                {w > 0 && (
                    <>
                        <svg width={w} height={h} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1 }}>
                            {positioned.map(({ pin, x, y }) => {
                                const box = placements.get(pin.id);
                                if (!box) return null;
                                return <line key={pin.id} x1={x} y1={y} x2={box.anchorX} y2={box.anchorY} stroke={STATE_COLOR[pin.state]} strokeWidth={Math.max(1, 1.5 * s)} />;
                            })}
                        </svg>

                        {positioned.map(({ pin }) => {
                            const box = placements.get(pin.id);
                            if (!box) return null;
                            const lines = pin.lines.length > 0 ? pin.lines : [];
                            return (
                                <Card key={pin.id} $color={STATE_COLOR[pin.state]} $s={s} style={{ left: box.x, top: box.y, width: box.w, height: box.h, zIndex: 2 }}>
                                    <strong>{pin.name}</strong>
                                    {lines.map((line, i) => (
                                        <span key={i} className={line.warn ? 'warn' : line.pending ? 'pending' : undefined}>
                                            {line.text}
                                            {line.pending ? ' *' : ''}
                                        </span>
                                    ))}
                                </Card>
                            );
                        })}

                        {positioned.map(({ pin, x, y, dragged }) => {
                            const node = (
                                <PinButton
                                    type="button"
                                    $color={STATE_COLOR[pin.state]}
                                    $s={s}
                                    $dragging={dragged}
                                    $interactive={interactive}
                                    style={{ left: x, top: y }}
                                    onPointerDown={onPinPointerDown ? (e) => onPinPointerDown(e, pin) : undefined}
                                    onClick={onPinClick}
                                    aria-label={`Posto ${pin.name}: ${pin.badge}`}
                                >
                                    {pin.badge}
                                </PinButton>
                            );
                            return <span key={pin.id}>{renderPin ? renderPin(pin, node) : node}</span>;
                        })}

                        {pendingPos && <PendingPin style={{ left: pendingPos.x * w, top: pendingPos.y * h }} />}
                    </>
                )}
            </Canvas>
            {footer}
        </Wrapper>
    );
}
