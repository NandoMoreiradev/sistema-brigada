// frontend/src/pages/certificates/editor/ElementView.tsx
//
// Desenha um elemento do layout em HTML/SVG, imitando o gerador de PDF do backend
// (mesma geometria do selo, ornamento, assinatura e QR; mesma altura de linha das
// fontes padrão). Recebe a caixa já posicionada pelo canvas: aqui tudo é relativo
// a ela, em pixels = pontos × escala.

import { memo, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import type {
    CertificateLayout,
    ImageElement,
    LayoutElement,
    OrnamentElement,
    QrCodeElement,
    SealElement,
    ShapeElement,
    SignatureElement,
    SyllabusElement,
    TextElement,
} from '../layout/types';
import { BASELINE_SHIFT, CSS_FONT, LINE_HEIGHT, effectiveStyle, renderCertificateText, resolveColor } from './layoutUtils';

export interface RenderContext {
    layout: CertificateLayout;
    scale: number;
    variables: Record<string, string>;
    /** Mostra {{variáveis}} em vez dos valores de exemplo */
    showVariables: boolean;
    brand: { organizationName: string; logoUrl: string | null; signatureName: string | null; signatureImageUrl: string | null };
    verification: { url: string; code: string; pageUrl: string };
    /** Miniatura (cartões de modelos): sem os avisos de "imagem não cadastrada" */
    thumbnail?: boolean;
    /** Ementa de exemplo para o bloco de conteúdo programático do verso */
    sampleSyllabus?: string;
}

const MIN_FONT_SIZE = 5;

const placeholderStyle = (scale: number): CSSProperties => ({
    width: '100%',
    height: '100%',
    border: `${Math.max(1, scale)}px dashed #94A3B8`,
    color: '#64748B',
    fontSize: Math.max(9, 10 * scale),
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    background: 'rgba(148, 163, 184, 0.08)',
    boxSizing: 'border-box',
    padding: 4,
});

function TextView({ element, ctx }: { element: TextElement; ctx: RenderContext }) {
    const { scale } = ctx;
    const raw = ctx.showVariables ? element.content : renderCertificateText(element.content, ctx.variables);
    const text = element.uppercase ? raw.toLocaleUpperCase('pt-BR') : raw;
    const boxRef = useRef<HTMLDivElement>(null);
    const innerRef = useRef<HTMLDivElement>(null);
    const [size, setSize] = useState(element.size);
    const style = effectiveStyle(element.font, element.bold, element.italic);

    // Mesmo "autoShrink" do PDF: diminui de 0,5 em 0,5 até o texto caber na caixa.
    useLayoutEffect(() => {
        const inner = innerRef.current;
        if (!inner) return;
        let next = element.size;
        inner.style.fontSize = `${next * scale}px`;
        inner.style.lineHeight = String(LINE_HEIGHT[element.font] + (element.lineGap ?? 0) / next);
        if (element.autoShrink) {
            const limit = element.h * scale + 0.5;
            while (next > MIN_FONT_SIZE && inner.scrollHeight > limit) {
                next = Math.max(MIN_FONT_SIZE, next - 0.5);
                inner.style.fontSize = `${next * scale}px`;
                inner.style.lineHeight = String(LINE_HEIGHT[element.font] + (element.lineGap ?? 0) / next);
            }
        }
        setSize(next);
    }, [text, element.size, element.autoShrink, element.font, element.lineGap, element.w, element.h, element.bold, element.italic, element.letterSpacing, scale]);

    if (!text.trim()) {
        if (ctx.thumbnail) return null;
        return <div style={{ ...placeholderStyle(scale), borderStyle: 'dotted', background: 'transparent' }}>{ctx.showVariables ? '' : 'texto vazio aqui'}</div>;
    }

    return (
        <div
            ref={boxRef}
            style={{
                width: '100%',
                height: '100%',
                // Sem cortar: o texto sobe um pouco (BASELINE_SHIFT) e acentos/maiúsculas passariam
                // da borda de cima da caixa — no PDF eles aparecem. Com autoShrink já cabe na caixa.
                overflow: 'visible',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: element.valign === 'middle' ? 'center' : element.valign === 'bottom' ? 'flex-end' : 'flex-start',
            }}
        >
            <div
                ref={innerRef}
                style={{
                    fontFamily: CSS_FONT[element.font],
                    fontSize: size * scale,
                    lineHeight: LINE_HEIGHT[element.font] + (element.lineGap ?? 0) / size,
                    fontWeight: style.bold ? 700 : 400,
                    fontStyle: style.italic ? 'italic' : 'normal',
                    fontSynthesis: 'none',
                    color: resolveColor(element.color, ctx.layout) ?? '#000',
                    textAlign: element.align,
                    letterSpacing: (element.letterSpacing ?? 0) * scale,
                    whiteSpace: 'pre-wrap',
                    overflowWrap: 'break-word',
                    position: 'relative',
                    top: -BASELINE_SHIFT[element.font] * size * scale,
                }}
            >
                {text}
            </div>
        </div>
    );
}

function ImageView({ element, ctx }: { element: ImageElement; ctx: RenderContext }) {
    const url = element.source === 'logo' ? ctx.brand.logoUrl : element.url;
    if (!url) {
        if (ctx.thumbnail) return null;
        return <div style={placeholderStyle(ctx.scale)}>{element.source === 'logo' ? 'Logo da academia (cadastre em Personalizar)' : 'Imagem — informe o endereço'}</div>;
    }
    return (
        <img
            src={url}
            alt=""
            draggable={false}
            style={{ width: '100%', height: '100%', objectFit: element.fit === 'stretch' ? 'fill' : element.fit, display: 'block', pointerEvents: 'none' }}
        />
    );
}

function SignatureView({ element, ctx }: { element: SignatureElement; ctx: RenderContext }) {
    const { scale, layout } = ctx;
    const lineY = element.h - 34;
    let name: string;
    let imageUrl: string | null | undefined;
    if (element.source === 'student') {
        name = ctx.showVariables ? '{{aluno.nome}}' : ctx.variables['aluno.nome'] ?? '';
    } else if (element.source === 'template') {
        name = ctx.brand.signatureName || 'Direção da Academia';
        imageUrl = ctx.brand.signatureImageUrl;
    } else {
        name = ctx.showVariables ? element.signerName ?? '' : renderCertificateText(element.signerName ?? '', ctx.variables);
        imageUrl = element.imageUrl;
    }
    const role = ctx.showVariables ? element.role : renderCertificateText(element.role, ctx.variables);
    const font = CSS_FONT[element.font ?? 'Helvetica'];
    const lineStyle = (top: number, size: number, bold: boolean, color: string | null): CSSProperties => ({
        position: 'absolute',
        left: 0,
        right: 0,
        top: top * scale,
        fontFamily: font,
        fontSize: size * scale,
        lineHeight: 1.15,
        fontWeight: bold && effectiveStyle(element.font ?? 'Helvetica', true, false).bold ? 700 : 400,
        fontSynthesis: 'none',
        color: color ?? '#000',
        textAlign: 'center',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
    });

    return (
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            {imageUrl && (
                <img
                    src={imageUrl}
                    alt=""
                    draggable={false}
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: ((element.w - Math.min(element.w * 0.6, 140)) / 2) * scale,
                        width: Math.min(element.w * 0.6, 140) * scale,
                        height: Math.max(0, lineY - 4) * scale,
                        objectFit: 'contain',
                        pointerEvents: 'none',
                    }}
                />
            )}
            <div style={{ position: 'absolute', left: 0, right: 0, top: lineY * scale, borderTop: `${Math.max(0.5, scale)}px solid ${resolveColor(element.lineColor, layout) ?? '#ADB5BD'}` }} />
            <div style={lineStyle(lineY + 6, 11, true, resolveColor(element.nameColor, layout))}>{name}</div>
            {role && <div style={lineStyle(lineY + 22, 9, false, resolveColor(element.roleColor, layout))}>{role}</div>}
        </div>
    );
}

function QrCodeView({ element, ctx }: { element: QrCodeElement; ctx: RenderContext }) {
    const { scale, layout } = ctx;
    const labels = element.showCode ? 34 : 0;
    const size = Math.max(0, Math.min(element.w, element.h - labels));
    const labelColor = resolveColor(element.labelColor, layout) ?? '#6C757D';
    const small: CSSProperties = { textAlign: 'center', fontFamily: CSS_FONT.Helvetica, lineHeight: 1.2, color: labelColor };
    return (
        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <QRCodeSVG value={ctx.verification.url} size={Math.max(1, size * scale)} fgColor={resolveColor(element.color, layout) ?? '#000'} marginSize={1} />
            {element.showCode && (
                <div style={{ width: '100%', marginTop: 3 * scale }}>
                    <div style={{ ...small, fontSize: 7 * scale }}>Código de verificação</div>
                    <div style={{ ...small, fontSize: 9 * scale, fontWeight: 700, color: resolveColor('$primary', layout) ?? '#000' }}>{ctx.verification.code}</div>
                    <div style={{ ...small, fontSize: 7 * scale }}>Valide em {ctx.verification.pageUrl}</div>
                </div>
            )}
        </div>
    );
}

function ShapeView({ element, ctx }: { element: ShapeElement; ctx: RenderContext }) {
    const { scale, layout } = ctx;
    const fill = resolveColor(element.fill, layout) ?? 'none';
    const stroke = element.strokeWidth > 0 ? resolveColor(element.stroke, layout) ?? 'none' : 'none';
    const sw = element.strokeWidth;
    const w = element.w;
    const h = element.h;
    return (
        <svg width={Math.max(1, w * scale)} height={Math.max(1, h * scale)} viewBox={`0 0 ${Math.max(w, 0.01)} ${Math.max(h, 0.01)}`} overflow="visible" style={{ display: 'block' }}>
            {element.shape === 'line' && <line x1={0} y1={0} x2={w} y2={h} stroke={stroke} strokeWidth={sw} />}
            {element.shape === 'ellipse' && <ellipse cx={w / 2} cy={h / 2} rx={w / 2} ry={h / 2} fill={fill} stroke={stroke} strokeWidth={sw} />}
            {element.shape === 'rect' && <rect x={0} y={0} width={w} height={h} rx={element.radius ?? 0} fill={fill} stroke={stroke} strokeWidth={sw} />}
        </svg>
    );
}

function initials(name: string) {
    return name
        .split(/\s+/)
        .filter((word) => /^[\p{L}\d]/u.test(word))
        .slice(0, 2)
        .map((word) => word[0]?.toUpperCase())
        .join('');
}

function SealView({ element, ctx }: { element: SealElement; ctx: RenderContext }) {
    const { scale, layout } = ctx;
    const outerR = element.w / 2;
    const innerR = outerR * (34 / 42);
    const cx = outerR;
    const cy = outerR;
    const points: string[] = [];
    for (let i = 0; i < 36; i++) {
        const r = i % 2 === 0 ? outerR : innerR;
        const angle = (Math.PI * i) / 18;
        points.push(`${cx + r * Math.sin(angle)},${cy - r * Math.cos(angle)}`);
    }
    const ribbonW = outerR * (26 / 42);
    const ribbonTop = cy + innerR - outerR * (8 / 42);
    const ribbonBottom = Math.min(element.h, ribbonTop + outerR * (46 / 42));
    const notch = outerR * (14 / 42);
    const logoSize = outerR * (44 / 42);
    const useLogo = element.content === 'logo' && ctx.brand.logoUrl;
    const color = resolveColor(element.color, layout) ?? '#1B2A4A';

    return (
        <svg width={element.w * scale} height={element.h * scale} viewBox={`0 0 ${element.w} ${element.h}`} overflow="visible" style={{ display: 'block' }}>
            {element.showRibbon && (
                <polygon
                    points={`${cx - ribbonW / 2},${ribbonTop} ${cx + ribbonW / 2},${ribbonTop} ${cx + ribbonW / 2},${ribbonBottom} ${cx},${ribbonBottom - notch} ${cx - ribbonW / 2},${ribbonBottom}`}
                    fill={resolveColor(element.ribbonColor, layout) ?? '#3A4F7A'}
                />
            )}
            <polygon points={points.join(' ')} fill={color} />
            <circle cx={cx} cy={cy} r={innerR - outerR * (6 / 42)} fill="#FFFFFF" stroke={resolveColor(element.ringColor, layout) ?? '#C9A227'} strokeWidth={1.5} />
            {useLogo ? (
                <image href={ctx.brand.logoUrl!} x={cx - logoSize / 2} y={cy - logoSize / 2} width={logoSize} height={logoSize} preserveAspectRatio="xMidYMid meet" />
            ) : (
                <text
                    x={cx}
                    y={cy}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontFamily={CSS_FONT.Helvetica}
                    fontWeight={700}
                    fontSize={outerR * (18 / 42)}
                    fill={color}
                >
                    {initials(ctx.brand.organizationName)}
                </text>
            )}
        </svg>
    );
}

function OrnamentView({ element, ctx }: { element: OrnamentElement; ctx: RenderContext }) {
    const { w, h } = element;
    const left = element.corner.endsWith('left');
    const top = element.corner.startsWith('top');
    const ox = left ? 0 : w;
    const oy = top ? 0 : h;
    const dx = left ? 1 : -1;
    const dy = top ? 1 : -1;
    const inner = 1 - 35 / 130;
    return (
        <svg width={w * ctx.scale} height={h * ctx.scale} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block' }}>
            <polygon points={`${ox},${oy} ${ox + dx * w},${oy} ${ox},${oy + dy * h}`} fill={resolveColor(element.accentColor, ctx.layout) ?? '#E4C465'} fillOpacity={0.9} />
            <polygon points={`${ox},${oy} ${ox + dx * w * inner},${oy} ${ox},${oy + dy * h * inner}`} fill={resolveColor(element.color, ctx.layout) ?? '#1B2A4A'} />
        </svg>
    );
}

/**
 * Conteúdo programático: o texto de exemplo em colunas. O que não cabe na caixa vai,
 * no PDF, para outra página de verso igual — aqui só avisa que vai continuar.
 */
function SyllabusView({ element, ctx }: { element: SyllabusElement; ctx: RenderContext }) {
    const { scale } = ctx;
    const innerRef = useRef<HTMLDivElement>(null);
    const [overflows, setOverflows] = useState(false);
    const [size, setSize] = useState(element.size);
    const text = ctx.sampleSyllabus ?? '';

    useLayoutEffect(() => {
        const inner = innerRef.current;
        if (!inner) return;
        const lineHeight = (s: number) => String(LINE_HEIGHT[element.font] + element.lineGap / s);
        let next = element.size;
        const apply = () => {
            inner.style.fontSize = `${next * scale}px`;
            inner.style.lineHeight = lineHeight(next);
        };
        apply();
        // Colunas CSS transbordam para a direita (mais colunas), não para baixo.
        const overflowing = () => inner.scrollWidth > inner.clientWidth + 1 || inner.scrollHeight > inner.clientHeight + 1;
        if (element.autoShrink) {
            while (next > element.minSize && overflowing()) {
                next = Math.max(element.minSize, next - 0.5);
                apply();
            }
        }
        setSize(next);
        setOverflows(overflowing());
    }, [text, element.size, element.minSize, element.autoShrink, element.font, element.lineGap, element.columns, element.columnGap, element.w, element.h, scale]);

    if (!text) {
        return <div style={placeholderStyle(scale)}>Conteúdo programático da turma</div>;
    }

    return (
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            <div
                ref={innerRef}
                style={{
                    width: '100%',
                    height: '100%',
                    overflow: 'hidden',
                    columnCount: element.columns,
                    columnGap: element.columnGap * scale,
                    columnFill: 'auto',
                    fontFamily: CSS_FONT[element.font],
                    fontSize: size * scale,
                    lineHeight: LINE_HEIGHT[element.font] + element.lineGap / size,
                    color: resolveColor(element.color, ctx.layout) ?? '#000',
                    textAlign: element.align,
                    whiteSpace: 'pre-wrap',
                    overflowWrap: 'break-word',
                    fontSynthesis: 'none',
                }}
            >
                {text}
            </div>
            {overflows && !ctx.thumbnail && (
                <div
                    style={{
                        position: 'absolute',
                        right: 0,
                        bottom: 0,
                        padding: '2px 6px',
                        borderRadius: 4,
                        background: '#2563eb',
                        color: '#fff',
                        fontSize: 11,
                        fontFamily: 'system-ui, sans-serif',
                    }}
                >
                    continua em outra página do verso
                </div>
            )}
        </div>
    );
}

export const ElementView = memo(function ElementView({ element, ctx }: { element: LayoutElement; ctx: RenderContext }) {
    switch (element.type) {
        case 'text':
            return <TextView element={element} ctx={ctx} />;
        case 'image':
            return <ImageView element={element} ctx={ctx} />;
        case 'signature':
            return <SignatureView element={element} ctx={ctx} />;
        case 'qrcode':
            return <QrCodeView element={element} ctx={ctx} />;
        case 'shape':
            return <ShapeView element={element} ctx={ctx} />;
        case 'seal':
            return <SealView element={element} ctx={ctx} />;
        case 'ornament':
            return <OrnamentView element={element} ctx={ctx} />;
        case 'syllabus':
            return <SyllabusView element={element} ctx={ctx} />;
    }
});
