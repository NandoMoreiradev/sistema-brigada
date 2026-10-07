// backend/src/certificates/layout/certificate-fonts.ts
//
// Fontes disponíveis nos textos do certificado. As três primeiras são as padrão
// do PDF (não embutem arquivo, mas só cobrem Latin-1). As demais são fontes
// livres (licença OFL) dos pacotes @fontsource, embutidas no PDF a partir do
// arquivo WOFF (subconjunto "latin": cobre o português inteiro, travessão, aspas
// curvas, €). O mesmo catálogo existe no frontend (editor/layoutUtils.ts) com os
// nomes CSS — mudou aqui, mude lá.

import { dirname, join } from 'path';

type Variant = 'regular' | 'bold' | 'italic' | 'boldItalic';

interface StandardFont {
    label: string;
    standard: Record<Variant, string>;
}

interface EmbeddedFont {
    label: string;
    /** Pacote @fontsource e quais variantes ele tem (a que faltar cai na mais próxima) */
    pkg: string;
    variants: Variant[];
}

export const FONT_CATALOG = {
    Helvetica: { label: 'Helvetica', standard: { regular: 'Helvetica', bold: 'Helvetica-Bold', italic: 'Helvetica-Oblique', boldItalic: 'Helvetica-BoldOblique' } },
    Times: { label: 'Times', standard: { regular: 'Times-Roman', bold: 'Times-Bold', italic: 'Times-Italic', boldItalic: 'Times-BoldItalic' } },
    Courier: { label: 'Courier', standard: { regular: 'Courier', bold: 'Courier-Bold', italic: 'Courier-Oblique', boldItalic: 'Courier-BoldOblique' } },
    Montserrat: { label: 'Montserrat', pkg: 'montserrat', variants: ['regular', 'bold', 'italic', 'boldItalic'] },
    OpenSans: { label: 'Open Sans', pkg: 'open-sans', variants: ['regular', 'bold', 'italic', 'boldItalic'] },
    Lora: { label: 'Lora', pkg: 'lora', variants: ['regular', 'bold', 'italic', 'boldItalic'] },
    PlayfairDisplay: { label: 'Playfair Display', pkg: 'playfair-display', variants: ['regular', 'bold', 'italic', 'boldItalic'] },
    RobotoSlab: { label: 'Roboto Slab', pkg: 'roboto-slab', variants: ['regular', 'bold'] },
    GreatVibes: { label: 'Great Vibes (manuscrita)', pkg: 'great-vibes', variants: ['regular'] },
} satisfies Record<string, StandardFont | EmbeddedFont>;

export type FontFamily = keyof typeof FONT_CATALOG;
export const FONT_FAMILIES = Object.keys(FONT_CATALOG) as FontFamily[];

const FILE_SUFFIX: Record<Variant, string> = { regular: '400-normal', bold: '700-normal', italic: '400-italic', boldItalic: '700-italic' };
/** Variante que falta → a mais próxima que existe */
const FALLBACK: Record<Variant, Variant[]> = {
    regular: ['regular'],
    bold: ['bold', 'regular'],
    italic: ['italic', 'regular'],
    boldItalic: ['boldItalic', 'bold', 'italic', 'regular'],
};

export interface ResolvedFont {
    /** Nome a passar para doc.font() */
    name: string;
    /** Arquivo a registrar com doc.registerFont(name, file) antes — só nas fontes embutidas */
    file?: string;
}

export function resolveFont(family: FontFamily, bold: boolean, italic: boolean): ResolvedFont {
    const variant: Variant = bold && italic ? 'boldItalic' : bold ? 'bold' : italic ? 'italic' : 'regular';
    const font: StandardFont | EmbeddedFont = FONT_CATALOG[family] ?? FONT_CATALOG.Helvetica;
    if ('standard' in font) return { name: font.standard[variant] };

    const available = FALLBACK[variant].find((candidate) => font.variants.includes(candidate)) ?? 'regular';
    const packageDir = dirname(require.resolve(`@fontsource/${font.pkg}/package.json`));
    return {
        name: `${family}-${available}`,
        file: join(packageDir, 'files', `${font.pkg}-latin-${FILE_SUFFIX[available]}.woff`),
    };
}
