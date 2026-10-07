// frontend/src/pages/certificates/editor/layoutUtils.ts
//
// Utilitários do editor visual que IMITAM o gerador de PDF do backend
// (backend/src/certificates/certificate-pdf.service.ts e
// layout/certificate-layout-variables.ts). O editor é uma aproximação em HTML;
// a palavra final é sempre a pré-visualização em PDF.

import type { CertificateLayout, ColorValue, FontFamily, LayoutElement } from '../layout/types';

const VARIABLE = /\{\{\s*([\w.]+)\s*\}\}/g;
const CONDITIONAL = /\{\{#if\s+([\w.]+)\s*\}\}([\s\S]*?)(?:\{\{else\}\}([\s\S]*?))?\{\{\/if\}\}/g;

/** Mesmo comportamento de renderCertificateText no backend. */
export function renderCertificateText(template: string, variables: Record<string, string>): string {
    return template
        .replace(CONDITIONAL, (_, key: string, whenTrue: string, whenFalse = '') => (variables[key]?.trim() ? whenTrue : whenFalse))
        .replace(VARIABLE, (_, key: string) => variables[key] ?? '');
}

/** Fonte do navegador mais próxima da fonte padrão do PDF. */
export const CSS_FONT: Record<FontFamily, string> = {
    Helvetica: 'Helvetica, Arial, "Liberation Sans", sans-serif',
    Times: '"Times New Roman", Times, "Liberation Serif", serif',
    Courier: '"Courier New", Courier, "Liberation Mono", monospace',
};

/**
 * Altura de linha do pdfkit para cada fonte padrão, em múltiplos do tamanho
 * ((ascendente + entrelinha − descendente) / 1000, das métricas AFM). Usar o mesmo
 * valor no CSS faz as quebras de linha do editor baterem com as do PDF.
 */
export const LINE_HEIGHT: Record<FontFamily, number> = { Helvetica: 1.156, Times: 1.116, Courier: 1.055 };

/**
 * O pdfkit põe a linha de base da 1ª linha em `topo + ascendente` (0,718 do tamanho na
 * Helvetica); o navegador a põe mais abaixo (meia entrelinha + ascendente da Arial etc.).
 * Subir o texto por esta fração do tamanho alinha as duas. Calculado com as métricas das
 * fontes equivalentes: Arial, Times New Roman e Courier New.
 */
export const BASELINE_SHIFT: Record<FontFamily, number> = { Helvetica: 0.206, Times: 0.212, Courier: 0.165 };

export const FONT_LABEL: Record<FontFamily, string> = { Helvetica: 'Helvetica (sem serifa)', Times: 'Times (serifada)', Courier: 'Courier (máquina de escrever)' };

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
};

export function elementLabel(element: LayoutElement): string {
    if (element.name) return element.name;
    if (element.type === 'text') return element.content.replace(/\s+/g, ' ').slice(0, 40) || 'Texto';
    return ELEMENT_TYPE_LABEL[element.type];
}

export const newId = () => `el-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
