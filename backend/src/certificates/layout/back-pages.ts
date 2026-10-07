// backend/src/certificates/layout/back-pages.ts
//
// Versos dos modelos prontos. O Clássico reproduz o verso fixo que existia antes do
// verso editável (título, nome do curso, conteúdo programático, rodapé com o código) —
// é também o verso dado aos layouts v1 na conversão (certificate-layout.validation.ts).

import { BackPage, Orientation, PAGE_SIZE } from './certificate-layout.types';

const FOOTER = 'Certificado {{certificado.codigo}} · valide em {{certificado.urlValidacao}}';
const SUBTITLE = '{{curso.nome}}{{#if curso.cargaHoraria}} · Carga horária: {{curso.cargaHoraria}}{{/if}}';

export function buildClassicBackPage(orientation: Orientation = 'landscape', title = 'CONTEÚDO PROGRAMÁTICO', enabled = true): BackPage {
    const { width: W, height: H } = PAGE_SIZE[orientation];
    return {
        enabled,
        onlyWithSyllabus: true,
        background: { color: '#FFFFFF', imageUrl: null },
        elements: [
            { id: 'back-frame-outer', name: 'Moldura externa', type: 'shape', shape: 'rect', x: 20, y: 20, w: W - 40, h: H - 40, stroke: '$accent', strokeWidth: 1.5, fill: null },
            { id: 'back-frame-inner', name: 'Moldura interna', type: 'shape', shape: 'rect', x: 28, y: 28, w: W - 56, h: H - 56, stroke: '$primary', strokeWidth: 1, fill: null },
            {
                id: 'back-title', name: 'Título do verso', type: 'text', x: 60, y: 55, w: W - 120, h: 32,
                content: title, font: 'Helvetica', size: 26, bold: true, italic: false, color: '$accent', align: 'center', valign: 'top', autoShrink: true,
            },
            {
                id: 'back-subtitle', name: 'Curso e carga horária', type: 'text', x: 60, y: 90, w: W - 120, h: 16,
                content: SUBTITLE, font: 'Helvetica', size: 12, bold: false, italic: false, color: '$muted', align: 'center', valign: 'top', autoShrink: true,
            },
            {
                id: 'back-syllabus', name: 'Conteúdo programático', type: 'syllabus', x: 90, y: 130, w: W - 180, h: H - 190,
                font: 'Helvetica', size: 11, minSize: 9, autoShrink: false, color: '$text', align: 'left', lineGap: 4, columns: 1, columnGap: 24,
            },
            {
                id: 'back-footer', name: 'Rodapé', type: 'text', x: 40, y: H - 44, w: W - 80, h: 10,
                content: FOOTER, font: 'Helvetica', size: 7, bold: false, italic: false, color: '$muted', align: 'center', valign: 'top', autoShrink: true,
            },
        ],
    };
}

export function buildModernBackPage(): BackPage {
    const { width: W, height: H } = PAGE_SIZE.landscape;
    return {
        enabled: true,
        onlyWithSyllabus: true,
        background: { color: '#FFFFFF', imageUrl: null },
        elements: [
            { id: 'back-band', name: 'Faixa lateral', type: 'shape', shape: 'rect', x: 0, y: 0, w: 200, h: H, fill: '$primary', stroke: null, strokeWidth: 0 },
            { id: 'back-band-accent', name: 'Filete da faixa', type: 'shape', shape: 'rect', x: 200, y: 0, w: 6, h: H, fill: '$accent', stroke: null, strokeWidth: 0 },
            {
                id: 'back-organization', name: 'Nome da academia', type: 'text', x: 20, y: 60, w: 160, h: 44,
                content: '{{academia.nome}}', font: 'Montserrat', size: 11, bold: true, italic: false, color: '#FFFFFF', align: 'center', valign: 'top', uppercase: true, letterSpacing: 1, autoShrink: true,
            },
            {
                id: 'back-title', name: 'Título do verso', type: 'text', x: 250, y: 56, w: 540, h: 30,
                content: 'CONTEÚDO PROGRAMÁTICO', font: 'Montserrat', size: 22, bold: true, italic: false, color: '$primary', align: 'left', valign: 'top', letterSpacing: 2, autoShrink: true,
            },
            {
                id: 'back-subtitle', name: 'Curso e carga horária', type: 'text', x: 250, y: 90, w: 540, h: 18,
                content: SUBTITLE, font: 'Montserrat', size: 11, bold: false, italic: false, color: '$muted', align: 'left', valign: 'top', autoShrink: true,
            },
            { id: 'back-divider', name: 'Divisor', type: 'shape', shape: 'line', x: 250, y: 118, w: 60, h: 0, stroke: '$accent', strokeWidth: 3, fill: null },
            {
                id: 'back-syllabus', name: 'Conteúdo programático', type: 'syllabus', x: 250, y: 140, w: W - 300, h: H - 210,
                font: 'Montserrat', size: 10, minSize: 8, autoShrink: true, color: '$text', align: 'left', lineGap: 3, columns: 2, columnGap: 28,
            },
            {
                id: 'back-footer', name: 'Rodapé', type: 'text', x: 250, y: H - 44, w: W - 300, h: 10,
                content: FOOTER, font: 'Montserrat', size: 7, bold: false, italic: false, color: '$muted', align: 'left', valign: 'top', autoShrink: true,
            },
        ],
    };
}

export function buildElegantBackPage(): BackPage {
    const { width: W, height: H } = PAGE_SIZE.landscape;
    return {
        enabled: true,
        onlyWithSyllabus: true,
        background: { color: '#FFFDF7', imageUrl: null },
        elements: [
            { id: 'back-frame-outer', name: 'Moldura externa', type: 'shape', shape: 'rect', x: 24, y: 24, w: W - 48, h: H - 48, stroke: '$accent', strokeWidth: 2, fill: null },
            { id: 'back-frame-inner', name: 'Moldura interna', type: 'shape', shape: 'rect', x: 32, y: 32, w: W - 64, h: H - 64, stroke: '$accent', strokeWidth: 0.75, fill: null },
            {
                id: 'back-title', name: 'Título do verso', type: 'text', x: 100, y: 58, w: W - 200, h: 44,
                content: 'Conteúdo programático', font: 'PlayfairDisplay', size: 30, bold: true, italic: true, color: '$primary', align: 'center', valign: 'middle', autoShrink: true,
            },
            { id: 'back-divider', name: 'Divisor', type: 'shape', shape: 'line', x: W / 2 - 60, y: 110, w: 120, h: 0, stroke: '$accent', strokeWidth: 1, fill: null },
            {
                id: 'back-subtitle', name: 'Curso e carga horária', type: 'text', x: 100, y: 120, w: W - 200, h: 18,
                content: SUBTITLE, font: 'Lora', size: 12, bold: false, italic: true, color: '$muted', align: 'center', valign: 'top', autoShrink: true,
            },
            {
                id: 'back-syllabus', name: 'Conteúdo programático', type: 'syllabus', x: 110, y: 158, w: W - 220, h: H - 238,
                font: 'Lora', size: 11, minSize: 9, autoShrink: true, color: '$text', align: 'left', lineGap: 3, columns: 2, columnGap: 32,
            },
            {
                id: 'back-footer', name: 'Rodapé', type: 'text', x: 100, y: H - 54, w: W - 200, h: 12,
                content: FOOTER, font: 'Lora', size: 8, bold: false, italic: true, color: '$muted', align: 'center', valign: 'top', autoShrink: true,
            },
        ],
    };
}
