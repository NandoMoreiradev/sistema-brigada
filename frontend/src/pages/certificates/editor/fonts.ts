// frontend/src/pages/certificates/editor/fonts.ts
//
// Fontes livres (OFL) do certificado para o editor desenhar igual ao PDF — os
// mesmos pacotes @fontsource que o backend embute (layout/certificate-fonts.ts),
// subconjunto latin. O navegador só baixa um arquivo quando algum texto o usa.

import '@fontsource/montserrat/latin-400.css';
import '@fontsource/montserrat/latin-700.css';
import '@fontsource/montserrat/latin-400-italic.css';
import '@fontsource/montserrat/latin-700-italic.css';
import '@fontsource/open-sans/latin-400.css';
import '@fontsource/open-sans/latin-700.css';
import '@fontsource/open-sans/latin-400-italic.css';
import '@fontsource/open-sans/latin-700-italic.css';
import '@fontsource/lora/latin-400.css';
import '@fontsource/lora/latin-700.css';
import '@fontsource/lora/latin-400-italic.css';
import '@fontsource/lora/latin-700-italic.css';
import '@fontsource/playfair-display/latin-400.css';
import '@fontsource/playfair-display/latin-700.css';
import '@fontsource/playfair-display/latin-400-italic.css';
import '@fontsource/playfair-display/latin-700-italic.css';
import '@fontsource/roboto-slab/latin-400.css';
import '@fontsource/roboto-slab/latin-700.css';
import '@fontsource/great-vibes/latin-400.css';

import type { FontFamily } from '../layout/types';

interface FontInfo {
    label: string;
    css: string;
    /** Altura de linha do pdfkit em múltiplos do tamanho ((ascendente + entrelinha − descendente) / unidades por em) */
    lineHeight: number;
    /** Quanto subir o texto para a linha de base bater com a do PDF (ver BASELINE_SHIFT em layoutUtils) */
    baselineShift: number;
    /** Variantes que o arquivo tem: as outras o PDF troca pela mais próxima, e o editor faz igual */
    hasBold: boolean;
    hasItalic: boolean;
}

/**
 * Métricas das fontes embutidas medidas com fontkit (o mesmo leitor do pdfkit). Nenhuma
 * delas tem entrelinha própria, então a linha de base já bate sem deslocamento.
 * As três padrão usam as métricas das equivalentes do sistema (Arial, Times New Roman, Courier New).
 */
export const FONTS: Record<FontFamily, FontInfo> = {
    Helvetica: { label: 'Helvetica', css: 'Helvetica, Arial, "Liberation Sans", sans-serif', lineHeight: 1.156, baselineShift: 0.206, hasBold: true, hasItalic: true },
    Times: { label: 'Times', css: '"Times New Roman", Times, "Liberation Serif", serif', lineHeight: 1.116, baselineShift: 0.212, hasBold: true, hasItalic: true },
    Courier: { label: 'Courier', css: '"Courier New", Courier, "Liberation Mono", monospace', lineHeight: 1.055, baselineShift: 0.165, hasBold: true, hasItalic: true },
    Montserrat: { label: 'Montserrat', css: '"Montserrat", sans-serif', lineHeight: 1.219, baselineShift: 0, hasBold: true, hasItalic: true },
    OpenSans: { label: 'Open Sans', css: '"Open Sans", sans-serif', lineHeight: 1.362, baselineShift: 0, hasBold: true, hasItalic: true },
    Lora: { label: 'Lora', css: '"Lora", serif', lineHeight: 1.28, baselineShift: 0, hasBold: true, hasItalic: true },
    PlayfairDisplay: { label: 'Playfair Display', css: '"Playfair Display", serif', lineHeight: 1.333, baselineShift: 0, hasBold: true, hasItalic: true },
    RobotoSlab: { label: 'Roboto Slab', css: '"Roboto Slab", serif', lineHeight: 1.319, baselineShift: 0, hasBold: true, hasItalic: false },
    GreatVibes: { label: 'Great Vibes (manuscrita)', css: '"Great Vibes", cursive', lineHeight: 1.252, baselineShift: 0, hasBold: false, hasItalic: false },
};

export const FONT_FAMILIES = Object.keys(FONTS) as FontFamily[];
