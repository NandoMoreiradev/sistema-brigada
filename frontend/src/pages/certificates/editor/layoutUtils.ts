// frontend/src/pages/certificates/editor/layoutUtils.ts
//
// Utilitários do editor visual que IMITAM o gerador de PDF do backend
// (backend/src/certificates/certificate-pdf.service.ts e
// layout/certificate-layout-variables.ts). O editor é uma aproximação em HTML;
// a palavra final é sempre a pré-visualização em PDF.

import type { CertificateLayout, ColorValue, FontFamily, LayoutElement } from '../layout/types';
import { FONTS } from './fonts';

const VARIABLE = /\{\{\s*([\w.]+)\s*\}\}/g;
const CONDITIONAL = /\{\{#if\s+([\w.]+)\s*\}\}([\s\S]*?)(?:\{\{else\}\}([\s\S]*?))?\{\{\/if\}\}/g;

/** Mesmo comportamento de renderCertificateText no backend. */
export function renderCertificateText(template: string, variables: Record<string, string>): string {
    return template
        .replace(CONDITIONAL, (_, key: string, whenTrue: string, whenFalse = '') => (variables[key]?.trim() ? whenTrue : whenFalse))
        .replace(VARIABLE, (_, key: string) => variables[key] ?? '');
}

/** Fonte CSS equivalente a cada fonte do PDF (ver fonts.ts). */
export const CSS_FONT = Object.fromEntries(Object.entries(FONTS).map(([id, font]) => [id, font.css])) as Record<FontFamily, string>;

/** Altura de linha do pdfkit, para as quebras de linha do editor baterem com as do PDF. */
export const LINE_HEIGHT = Object.fromEntries(Object.entries(FONTS).map(([id, font]) => [id, font.lineHeight])) as Record<FontFamily, number>;

/**
 * O pdfkit põe a linha de base da 1ª linha em `topo + ascendente`; o navegador põe mais
 * abaixo quando a fonte tem entrelinha (meia entrelinha + ascendente). Subir o texto por
 * esta fração do tamanho alinha as duas.
 */
export const BASELINE_SHIFT = Object.fromEntries(Object.entries(FONTS).map(([id, font]) => [id, font.baselineShift])) as Record<FontFamily, number>;

export const FONT_LABEL = Object.fromEntries(Object.entries(FONTS).map(([id, font]) => [id, font.label])) as Record<FontFamily, string>;

/** O PDF troca a variante que a fonte não tem pela mais próxima; o editor imita para não mostrar um negrito falso. */
export const effectiveStyle = (font: FontFamily, bold: boolean, italic: boolean) => ({
    bold: bold && FONTS[font].hasBold,
    italic: italic && FONTS[font].hasItalic,
});

export function resolveColor(value: ColorValue | null | undefined, layout: CertificateLayout): string | null {
    if (!value) return null;
    if (value.startsWith('$')) return layout.theme[value.slice(1) as keyof CertificateLayout['theme']] ?? '#000000';
    return value;
}

/** O usuário pensa em milímetros; o layout guarda pontos PDF. */
export const PT_PER_MM = 72 / 25.4;
export const ptToMm = (pt: number) => Math.round((pt / PT_PER_MM) * 10) / 10;
export const mmToPt = (mm: number) => Math.round(mm * PT_PER_MM * 100) / 100;

export const ELEMENT_TYPE_LABEL: Record<LayoutElement['type'], string> = {
    text: 'Texto',
    image: 'Imagem',
    signature: 'Assinatura',
    qrcode: 'QR de validação',
    shape: 'Forma',
    seal: 'Selo',
    ornament: 'Ornamento de canto',
    syllabus: 'Conteúdo programático',
};

export function elementLabel(element: LayoutElement): string {
    if (element.name) return element.name;
    if (element.type === 'text') return element.content.replace(/\s+/g, ' ').slice(0, 40) || 'Texto';
    return ELEMENT_TYPE_LABEL[element.type];
}

export const newId = () => `el-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
