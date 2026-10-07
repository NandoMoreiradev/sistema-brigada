// backend/src/certificates/layout/certificate-layout.types.ts
//
// Formato do layout do certificado (guardado em CertificateDesign.layout). A frente
// e o verso são listas de elementos posicionados sobre a página, desenhados na
// ordem da lista (o último fica por cima). Coordenadas e tamanhos em pontos PDF
// (1pt = 1/72"), origem no canto superior esquerdo — a mesma unidade do pdfkit, então
// o gerador não converte nada. A4 deitado = 841,89 × 595,28pt.
//
// O editor visual (frontend) manipula este mesmo formato; o tipo é espelhado em
// frontend/src/pages/certificates/layout/types.ts. Mudou aqui, mude lá — e suba
// `version` se a mudança não for compatível com layouts já salvos.
//
// Versão 2: o verso deixou de ser fixo (`syllabusPage: { enabled, title }`) e virou
// uma página editável (`backPage`). Layouts v1 são convertidos na leitura
// (certificate-layout.validation.ts) — não há migração de banco.

export const LAYOUT_VERSION = 2;

export const PAGE_SIZE = {
    landscape: { width: 841.89, height: 595.28 },
    portrait: { width: 595.28, height: 841.89 },
} as const;

export type Orientation = keyof typeof PAGE_SIZE;

/** Cor fixa (#RRGGBB) ou referência a uma cor do tema ($primary...), que muda junto com o tema. */
export type ColorValue = string;

export const THEME_COLOR_KEYS = ['primary', 'primaryLight', 'accent', 'accentLight', 'text', 'muted'] as const;
export type ThemeColorKey = (typeof THEME_COLOR_KEYS)[number];
export type LayoutTheme = Record<ThemeColorKey, string>;

export { FONT_FAMILIES, type FontFamily } from './certificate-fonts';
import type { FontFamily } from './certificate-fonts';

interface BaseElement {
    id: string;
    /** Nome para a lista de camadas do editor */
    name?: string;
    x: number;
    y: number;
    w: number;
    h: number;
    /** Graus, horário, em torno do centro */
    rotation?: number;
    /** 0–1 */
    opacity?: number;
    hidden?: boolean;
    /** Só para o editor: não move/redimensiona por engano */
    locked?: boolean;
}

export interface TextElement extends BaseElement {
    type: 'text';
    /** Pode conter variáveis ({{aluno.nome}}) e condicionais ({{#if curso.local}}...{{/if}}) */
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
    /** Diminui a fonte até o texto caber na caixa (nomes longos) */
    autoShrink: boolean;
}

export interface ImageElement extends BaseElement {
    type: 'image';
    /** 'logo' = logo cadastrada na personalização da academia */
    source: 'logo' | 'url';
    url?: string | null;
    fit: 'contain' | 'cover' | 'stretch';
}

export interface SignatureElement extends BaseElement {
    type: 'signature';
    /** 'template' = nome/imagem da personalização da academia; 'student' = linha em branco com o nome do aluno */
    source: 'template' | 'custom' | 'student';
    /** Só em 'custom' (aceita variáveis). Não confundir com `name`, o nome da camada. */
    signerName?: string;
    role: string;
    imageUrl?: string | null;
    lineColor: ColorValue;
    nameColor: ColorValue;
    roleColor: ColorValue;
    /** Fonte do nome e do cargo (padrão Helvetica) */
    font?: FontFamily;
}

export interface QrCodeElement extends BaseElement {
    type: 'qrcode';
    /** Mostra o código de verificação e o endereço de validação abaixo do QR */
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
    /** Cantos arredondados (só retângulo) */
    radius?: number;
}

/** Selo recortado com fita (o do layout clássico), com a logo ou as iniciais da academia dentro. */
export interface SealElement extends BaseElement {
    type: 'seal';
    color: ColorValue;
    ringColor: ColorValue;
    ribbonColor: ColorValue;
    showRibbon: boolean;
    content: 'logo' | 'initials';
}

/** Par de triângulos de canto (o "swoosh" do layout clássico). */
export interface OrnamentElement extends BaseElement {
    type: 'ornament';
    corner: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
    color: ColorValue;
    accentColor: ColorValue;
}

/**
 * Conteúdo programático da turma (só no verso). O texto que não couber na caixa
 * continua numa página seguinte com o mesmo desenho do verso — depois de diminuir a
 * fonte até `minSize`, se `autoShrink`.
 */
export interface SyllabusElement extends BaseElement {
    type: 'syllabus';
    font: FontFamily;
    size: number;
    /** Até onde a fonte pode diminuir antes de continuar em outra página */
    minSize: number;
    autoShrink: boolean;
    color: ColorValue;
    align: 'left' | 'justify';
    lineGap: number;
    /** 1 a 3 colunas */
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
export type LayoutElementType = LayoutElement['type'];

export interface CertificateLayout {
    version: number;
    orientation: Orientation;
    theme: LayoutTheme;
    background: {
        color: ColorValue;
        /** Arte de fundo de página inteira (PNG/JPG) — a academia pode usar o próprio modelo pronto */
        imageUrl?: string | null;
    };
    elements: LayoutElement[];
    /** Verso (2ª página): onde normalmente vai o conteúdo programático da turma */
    backPage: BackPage;
}

export interface BackPage {
    enabled: boolean;
    /** Só imprime o verso quando a turma tem conteúdo programático preenchido */
    onlyWithSyllabus: boolean;
    background: { color: ColorValue; imageUrl?: string | null };
    elements: LayoutElement[];
}
