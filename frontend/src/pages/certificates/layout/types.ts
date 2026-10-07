// frontend/src/pages/certificates/layout/types.ts
//
// Espelho de backend/src/certificates/layout/certificate-layout.types.ts — o
// layout do certificado como o backend guarda e desenha. Mudou lá, mude aqui.
// Coordenadas em pontos PDF (A4 deitado = 841,89 × 595,28).

export const PAGE_SIZE = {
    landscape: { width: 841.89, height: 595.28 },
    portrait: { width: 595.28, height: 841.89 },
} as const;

export type Orientation = keyof typeof PAGE_SIZE;

/** #RRGGBB ou referência ao tema ($primary...) */
export type ColorValue = string;

export const THEME_COLORS = [
    { key: 'primary', label: 'Principal' },
    { key: 'primaryLight', label: 'Principal (clara)' },
    { key: 'accent', label: 'Destaque' },
    { key: 'accentLight', label: 'Destaque (clara)' },
    { key: 'text', label: 'Texto' },
    { key: 'muted', label: 'Texto secundário' },
] as const;

export type ThemeColorKey = (typeof THEME_COLORS)[number]['key'];
export type LayoutTheme = Record<ThemeColorKey, string>;

/** Ids do catálogo de fontes (backend: layout/certificate-fonts.ts; frontend: editor/fonts.ts) */
export type FontFamily = 'Helvetica' | 'Times' | 'Courier' | 'Montserrat' | 'OpenSans' | 'Lora' | 'PlayfairDisplay' | 'RobotoSlab' | 'GreatVibes';

interface BaseElement {
    id: string;
    name?: string;
    x: number;
    y: number;
    w: number;
    h: number;
    rotation?: number;
    opacity?: number;
    hidden?: boolean;
    locked?: boolean;
}

export interface TextElement extends BaseElement {
    type: 'text';
    content: string;
    font: FontFamily;
    size: number;
    bold: boolean;
    italic: boolean;
    color: ColorValue;
    align: 'left' | 'center' | 'right' | 'justify';
    valign: 'top' | 'middle' | 'bottom';
    uppercase?: boolean;
    letterSpacing?: number;
    lineGap?: number;
    autoShrink: boolean;
}

export interface ImageElement extends BaseElement {
    type: 'image';
    source: 'logo' | 'url';
    url?: string | null;
    fit: 'contain' | 'cover' | 'stretch';
}

export interface SignatureElement extends BaseElement {
    type: 'signature';
    source: 'template' | 'custom' | 'student';
    signerName?: string;
    role: string;
    imageUrl?: string | null;
    lineColor: ColorValue;
    nameColor: ColorValue;
    roleColor: ColorValue;
    font?: FontFamily;
}

export interface QrCodeElement extends BaseElement {
    type: 'qrcode';
    showCode: boolean;
    color: ColorValue;
    labelColor: ColorValue;
}

export interface ShapeElement extends BaseElement {
    type: 'shape';
    shape: 'rect' | 'ellipse' | 'line';
    fill?: ColorValue | null;
    stroke?: ColorValue | null;
    strokeWidth: number;
    radius?: number;
}

export interface SealElement extends BaseElement {
    type: 'seal';
    color: ColorValue;
    ringColor: ColorValue;
    ribbonColor: ColorValue;
    showRibbon: boolean;
    content: 'logo' | 'initials';
}

export interface OrnamentElement extends BaseElement {
    type: 'ornament';
    corner: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
    color: ColorValue;
    accentColor: ColorValue;
}

/** Conteúdo programático da turma (só no verso); o que não cabe continua em outra página igual. */
export interface SyllabusElement extends BaseElement {
    type: 'syllabus';
    font: FontFamily;
    size: number;
    minSize: number;
    autoShrink: boolean;
    color: ColorValue;
    align: 'left' | 'justify';
    lineGap: number;
    columns: number;
    columnGap: number;
}

export type LayoutElement =
    | TextElement
    | ImageElement
    | SignatureElement
    | QrCodeElement
    | ShapeElement
    | SealElement
    | OrnamentElement
    | SyllabusElement;

export interface PageBackground {
    color: ColorValue;
    imageUrl?: string | null;
}

export interface BackPage {
    enabled: boolean;
    /** Só imprime o verso quando a turma tem conteúdo programático */
    onlyWithSyllabus: boolean;
    background: PageBackground;
    elements: LayoutElement[];
}

export interface CertificateLayout {
    version: number;
    orientation: Orientation;
    theme: LayoutTheme;
    background: PageBackground;
    elements: LayoutElement[];
    backPage: BackPage;
}

export interface CertificateVariable {
    key: string;
    label: string;
    example: string;
}
