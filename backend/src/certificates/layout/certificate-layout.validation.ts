// backend/src/certificates/layout/certificate-layout.validation.ts
//
// Valida e normaliza um layout vindo da API. É Json livre no banco, então tudo é
// conferido aqui: tipos, limites de tamanho (um layout gigante viraria um PDF lento
// para cada certificado emitido), cores e URLs. Devolve uma cópia só com os campos
// conhecidos — nada de propriedade extra indo parar no banco.

import {
    CertificateLayout,
    FONT_FAMILIES,
    LAYOUT_VERSION,
    LayoutElement,
    PAGE_SIZE,
    THEME_COLOR_KEYS,
} from './certificate-layout.types';

export class LayoutValidationError extends Error {
    constructor(public readonly problems: string[]) {
        super(problems.join(' '));
    }
}

const MAX_ELEMENTS = 80;
const MAX_TEXT = 2000;
const HEX = /^#[0-9a-fA-F]{6}$/;
const THEME_REF = new RegExp(`^\\$(${THEME_COLOR_KEYS.join('|')})$`);

type Raw = Record<string, unknown>;

class Reader {
    readonly problems: string[] = [];

    constructor(private readonly where: string) {}

    private fail(field: string, message: string) {
        this.problems.push(`${this.where}${field ? ` (${field})` : ''}: ${message}`);
    }

    number(raw: Raw, field: string, min: number, max: number, fallback?: number): number {
        const value = raw[field];
        if (value === undefined && fallback !== undefined) return fallback;
        if (typeof value !== 'number' || !Number.isFinite(value)) {
            this.fail(field, 'precisa ser um número.');
            return fallback ?? min;
        }
        if (value < min || value > max) {
            this.fail(field, `precisa estar entre ${min} e ${max}.`);
        }
        return Math.min(max, Math.max(min, value));
    }

    boolean(raw: Raw, field: string, fallback: boolean): boolean {
        const value = raw[field];
        if (value === undefined) return fallback;
        if (typeof value !== 'boolean') this.fail(field, 'precisa ser verdadeiro ou falso.');
        return value === true;
    }

    string(raw: Raw, field: string, maxLength: number, fallback?: string): string {
        const value = raw[field];
        if (value === undefined && fallback !== undefined) return fallback;
        if (typeof value !== 'string') {
            this.fail(field, 'precisa ser um texto.');
            return fallback ?? '';
        }
        if (value.length > maxLength) this.fail(field, `pode ter no máximo ${maxLength} caracteres.`);
        return value.slice(0, maxLength);
    }

    oneOf<T extends string>(raw: Raw, field: string, options: readonly T[], fallback?: T): T {
        const value = raw[field];
        if (value === undefined && fallback !== undefined) return fallback;
        if (!options.includes(value as T)) {
            this.fail(field, `valor inválido (use ${options.join(', ')}).`);
            return fallback ?? options[0];
        }
        return value as T;
    }

    color(raw: Raw, field: string, nullable: true): string | null;
    color(raw: Raw, field: string, nullable?: false): string;
    color(raw: Raw, field: string, nullable = false): string | null {
        const value = raw[field];
        if ((value === null || value === undefined) && nullable) return null;
        if (typeof value !== 'string' || !(HEX.test(value) || THEME_REF.test(value))) {
            this.fail(field, 'cor inválida (use #RRGGBB ou uma cor do tema).');
            return nullable ? null : '#000000';
        }
        return value;
    }

    url(raw: Raw, field: string): string | null {
        const value = raw[field];
        if (value === null || value === undefined || value === '') return null;
        if (typeof value !== 'string' || value.length > 2048) {
            this.fail(field, 'endereço inválido.');
            return null;
        }
        try {
            const parsed = new URL(value);
            if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') throw new Error();
            return value;
        } catch {
            this.fail(field, 'endereço de imagem inválido (use http:// ou https://).');
            return null;
        }
    }
}

const asObject = (value: unknown): Raw | null => (value && typeof value === 'object' && !Array.isArray(value) ? (value as Raw) : null);

function readElement(raw: Raw, index: number, pageWidth: number, pageHeight: number, reader: Reader): LayoutElement | null {
    const r = new Reader(`Elemento ${index + 1}`);
    const id = r.string(raw, 'id', 64);
    const base = {
        id: id || `el-${index + 1}`,
        name: raw.name === undefined ? undefined : r.string(raw, 'name', 80),
        // Pode sair um pouco da página (sangria), mas não absurdamente.
        x: r.number(raw, 'x', -pageWidth, pageWidth * 2),
        y: r.number(raw, 'y', -pageHeight, pageHeight * 2),
        w: r.number(raw, 'w', 0, pageWidth * 2),
        h: r.number(raw, 'h', 0, pageHeight * 2),
        rotation: r.number(raw, 'rotation', -360, 360, 0),
        opacity: r.number(raw, 'opacity', 0, 1, 1),
        hidden: r.boolean(raw, 'hidden', false),
        locked: r.boolean(raw, 'locked', false),
    };

    let element: LayoutElement | null = null;
    switch (raw.type) {
        case 'text':
            element = {
                ...base,
                type: 'text',
                content: r.string(raw, 'content', MAX_TEXT),
                font: r.oneOf(raw, 'font', FONT_FAMILIES, 'Helvetica'),
                size: r.number(raw, 'size', 4, 200),
                bold: r.boolean(raw, 'bold', false),
                italic: r.boolean(raw, 'italic', false),
                color: r.color(raw, 'color'),
                align: r.oneOf(raw, 'align', ['left', 'center', 'right', 'justify'] as const, 'left'),
                valign: r.oneOf(raw, 'valign', ['top', 'middle', 'bottom'] as const, 'top'),
                uppercase: r.boolean(raw, 'uppercase', false),
                letterSpacing: r.number(raw, 'letterSpacing', -5, 30, 0),
                lineGap: r.number(raw, 'lineGap', 0, 50, 0),
                autoShrink: r.boolean(raw, 'autoShrink', true),
            };
            break;
        case 'image':
            element = {
                ...base,
                type: 'image',
                source: r.oneOf(raw, 'source', ['logo', 'url'] as const),
                url: r.url(raw, 'url'),
                fit: r.oneOf(raw, 'fit', ['contain', 'cover', 'stretch'] as const, 'contain'),
            };
            break;
        case 'signature':
            element = {
                ...base,
                type: 'signature',
                source: r.oneOf(raw, 'source', ['template', 'custom', 'student'] as const),
                signerName: raw.signerName === undefined ? undefined : r.string(raw, 'signerName', 120),
                role: r.string(raw, 'role', 120, ''),
                imageUrl: r.url(raw, 'imageUrl'),
                lineColor: r.color(raw, 'lineColor'),
                nameColor: r.color(raw, 'nameColor'),
                roleColor: r.color(raw, 'roleColor'),
            };
            break;
        case 'qrcode':
            element = {
                ...base,
                type: 'qrcode',
                showCode: r.boolean(raw, 'showCode', true),
                color: r.color(raw, 'color'),
                labelColor: r.color(raw, 'labelColor'),
            };
            break;
        case 'shape':
            element = {
                ...base,
                type: 'shape',
                shape: r.oneOf(raw, 'shape', ['rect', 'ellipse', 'line'] as const),
                fill: r.color(raw, 'fill', true),
                stroke: r.color(raw, 'stroke', true),
                strokeWidth: r.number(raw, 'strokeWidth', 0, 50, 0),
                radius: r.number(raw, 'radius', 0, 300, 0),
            };
            break;
        case 'seal':
            element = {
                ...base,
                type: 'seal',
                color: r.color(raw, 'color'),
                ringColor: r.color(raw, 'ringColor'),
                ribbonColor: r.color(raw, 'ribbonColor'),
                showRibbon: r.boolean(raw, 'showRibbon', true),
                content: r.oneOf(raw, 'content', ['logo', 'initials'] as const, 'logo'),
            };
            break;
        case 'ornament':
            element = {
                ...base,
                type: 'ornament',
                corner: r.oneOf(raw, 'corner', ['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const),
                color: r.color(raw, 'color'),
                accentColor: r.color(raw, 'accentColor'),
            };
            break;
        default:
            r.problems.push(`Elemento ${index + 1}: tipo desconhecido.`);
    }

    reader.problems.push(...r.problems);
    return element;
}

/** Lança LayoutValidationError com a lista de problemas, em português, para mostrar ao usuário. */
export function parseCertificateLayout(input: unknown): CertificateLayout {
    const raw = asObject(input);
    if (!raw) throw new LayoutValidationError(['O layout precisa ser um objeto.']);

    const r = new Reader('Layout');
    const orientation = r.oneOf(raw, 'orientation', ['landscape', 'portrait'] as const, 'landscape');
    const { width, height } = PAGE_SIZE[orientation];

    const rawTheme = asObject(raw.theme) ?? {};
    const theme = Object.fromEntries(
        THEME_COLOR_KEYS.map((key) => {
            const value = rawTheme[key];
            if (typeof value !== 'string' || !HEX.test(value)) {
                r.problems.push(`Tema: a cor "${key}" precisa estar no formato #RRGGBB.`);
                return [key, '#000000'];
            }
            return [key, value];
        }),
    ) as CertificateLayout['theme'];

    const rawBackground = asObject(raw.background) ?? {};
    const rawSyllabus = asObject(raw.syllabusPage) ?? {};

    const rawElements = Array.isArray(raw.elements) ? raw.elements : [];
    if (!Array.isArray(raw.elements)) r.problems.push('Layout: a lista de elementos é obrigatória.');
    if (rawElements.length > MAX_ELEMENTS) r.problems.push(`Layout: use no máximo ${MAX_ELEMENTS} elementos.`);

    const elements: LayoutElement[] = [];
    const ids = new Set<string>();
    rawElements.slice(0, MAX_ELEMENTS).forEach((item, index) => {
        const rawElement = asObject(item);
        if (!rawElement) {
            r.problems.push(`Elemento ${index + 1}: formato inválido.`);
            return;
        }
        const element = readElement(rawElement, index, width, height, r);
        if (!element) return;
        if (ids.has(element.id)) element.id = `${element.id}-${index + 1}`;
        ids.add(element.id);
        elements.push(element);
    });

    const layout: CertificateLayout = {
        version: LAYOUT_VERSION,
        orientation,
        theme,
        background: { color: r.color(rawBackground, 'color'), imageUrl: r.url(rawBackground, 'imageUrl') },
        elements,
        syllabusPage: {
            enabled: r.boolean(rawSyllabus, 'enabled', true),
            title: r.string(rawSyllabus, 'title', 120, 'CONTEÚDO PROGRAMÁTICO'),
        },
    };

    if (r.problems.length) throw new LayoutValidationError(r.problems);
    return layout;
}
