// backend/src/certificates/layout/layout-presets.ts
//
// Modelos prontos oferecidos no editor como ponto de partida. São só layouts
// (mesmo formato do salvo) — escolher um copia os elementos para o editor, e a
// academia ajusta a partir dali. O Clássico é também o padrão de quem nunca salvou.

import { CertificateLayout, LAYOUT_VERSION, PAGE_SIZE } from './certificate-layout.types';
import { buildClassicLayout } from './classic-layout';

const { width: W, height: H } = PAGE_SIZE.landscape;

export interface LayoutPreset {
    id: string;
    name: string;
    description: string;
    layout: CertificateLayout;
}

function buildModernLayout(): CertificateLayout {
    return {
        version: LAYOUT_VERSION,
        orientation: 'landscape',
        theme: { primary: '#0F3D5E', primaryLight: '#1E6091', accent: '#E76F51', accentLight: '#F4A261', text: '#1F2933', muted: '#6B7280' },
        background: { color: '#FFFFFF', imageUrl: null },
        syllabusPage: { enabled: true, title: 'CONTEÚDO PROGRAMÁTICO' },
        elements: [
            { id: 'band', name: 'Faixa lateral', type: 'shape', shape: 'rect', x: 0, y: 0, w: 200, h: H, fill: '$primary', stroke: null, strokeWidth: 0 },
            { id: 'band-accent', name: 'Filete da faixa', type: 'shape', shape: 'rect', x: 200, y: 0, w: 6, h: H, fill: '$accent', stroke: null, strokeWidth: 0 },
            { id: 'logo', name: 'Logo', type: 'image', source: 'logo', url: null, fit: 'contain', x: 40, y: 50, w: 120, h: 120 },
            {
                id: 'organization', name: 'Nome da academia', type: 'text', x: 20, y: 185, w: 160, h: 44,
                content: '{{academia.nome}}', font: 'Helvetica', size: 11, bold: true, italic: false, color: '#FFFFFF', align: 'center', valign: 'top', uppercase: true, letterSpacing: 1, autoShrink: true,
            },
            {
                id: 'title', name: 'Título', type: 'text', x: 250, y: 60, w: 540, h: 46,
                content: 'CERTIFICADO', font: 'Helvetica', size: 40, bold: true, italic: false, color: '$primary', align: 'left', valign: 'top', letterSpacing: 4, autoShrink: true,
            },
            {
                id: 'subtitle', name: 'Subtítulo', type: 'text', x: 250, y: 108, w: 540, h: 20,
                content: 'DE CONCLUSÃO', font: 'Helvetica', size: 13, bold: true, italic: false, color: '$accent', align: 'left', valign: 'top', letterSpacing: 3, autoShrink: true,
            },
            { id: 'divider', name: 'Divisor', type: 'shape', shape: 'line', x: 250, y: 142, w: 60, h: 0, stroke: '$accent', strokeWidth: 3, fill: null },
            {
                id: 'intro', name: 'Abertura', type: 'text', x: 250, y: 172, w: 540, h: 18,
                content: 'Certificamos que', font: 'Helvetica', size: 13, bold: false, italic: false, color: '$muted', align: 'left', valign: 'top', autoShrink: true,
            },
            {
                id: 'student-name', name: 'Nome do aluno', type: 'text', x: 250, y: 194, w: 540, h: 44,
                content: '{{aluno.nome}}', font: 'Helvetica', size: 30, bold: true, italic: false, color: '$text', align: 'left', valign: 'middle', autoShrink: true,
            },
            {
                id: 'body', name: 'Texto principal', type: 'text', x: 250, y: 248, w: 540, h: 70,
                content:
                    'concluiu o curso {{curso.nome}}{{#if curso.cargaHoraria}}, com carga horária de {{curso.cargaHoraria}}{{/if}}, realizado {{curso.periodo}}{{#if curso.local}}, em {{curso.local}}{{/if}}.',
                font: 'Helvetica', size: 12.5, bold: false, italic: false, color: '$text', align: 'left', valign: 'top', lineGap: 4, autoShrink: true,
            },
            {
                id: 'issue', name: 'Local e data', type: 'text', x: 250, y: 330, w: 540, h: 30,
                content: '{{academia.nome}}, {{certificado.emissaoExtenso}}.{{#if certificado.validade}} Válido até {{certificado.validade}}.{{/if}}',
                font: 'Helvetica', size: 10, bold: false, italic: false, color: '$muted', align: 'left', valign: 'top', autoShrink: true,
            },
            {
                id: 'signature-academy', name: 'Assinatura da academia', type: 'signature', source: 'template', x: 250, y: H - 160, w: 210, h: 84,
                role: 'Direção', lineColor: '$primary', nameColor: '$text', roleColor: '$muted',
            },
            {
                id: 'signature-student', name: 'Assinatura do aluno', type: 'signature', source: 'student', x: 480, y: H - 160, w: 170, h: 84,
                role: 'Aluno(a)', lineColor: '$primary', nameColor: '$text', roleColor: '$muted',
            },
            { id: 'qrcode', name: 'QR de validação', type: 'qrcode', x: W - 175, y: H - 175, w: 130, h: 124, showCode: true, color: '#000000', labelColor: '$muted' },
        ],
    };
}

function buildElegantLayout(): CertificateLayout {
    return {
        version: LAYOUT_VERSION,
        orientation: 'landscape',
        theme: { primary: '#3B2F2F', primaryLight: '#6B4F4F', accent: '#B08D57', accentLight: '#D8C3A5', text: '#2B2B2B', muted: '#7A6F66' },
        background: { color: '#FFFDF7', imageUrl: null },
        syllabusPage: { enabled: true, title: 'Conteúdo programático' },
        elements: [
            { id: 'frame-outer', name: 'Moldura externa', type: 'shape', shape: 'rect', x: 24, y: 24, w: W - 48, h: H - 48, stroke: '$accent', strokeWidth: 2, fill: null },
            { id: 'frame-inner', name: 'Moldura interna', type: 'shape', shape: 'rect', x: 32, y: 32, w: W - 64, h: H - 64, stroke: '$accent', strokeWidth: 0.75, fill: null },
            {
                id: 'organization', name: 'Nome da academia', type: 'text', x: 100, y: 62, w: W - 200, h: 18,
                content: '{{academia.nome}}', font: 'Times', size: 12, bold: false, italic: false, color: '$muted', align: 'center', valign: 'top', uppercase: true, letterSpacing: 3, autoShrink: true,
            },
            {
                id: 'title', name: 'Título', type: 'text', x: 100, y: 88, w: W - 200, h: 60,
                content: 'Certificado', font: 'Times', size: 46, bold: true, italic: true, color: '$primary', align: 'center', valign: 'middle', autoShrink: true,
            },
            { id: 'divider', name: 'Divisor', type: 'shape', shape: 'line', x: W / 2 - 60, y: 158, w: 120, h: 0, stroke: '$accent', strokeWidth: 1, fill: null },
            {
                id: 'intro', name: 'Abertura', type: 'text', x: 100, y: 176, w: W - 200, h: 20,
                content: 'Certificamos que', font: 'Times', size: 14, bold: false, italic: true, color: '$text', align: 'center', valign: 'top', autoShrink: true,
            },
            {
                id: 'student-name', name: 'Nome do aluno', type: 'text', x: 100, y: 200, w: W - 200, h: 44,
                content: '{{aluno.nome}}', font: 'Times', size: 30, bold: true, italic: false, color: '$primary', align: 'center', valign: 'middle', autoShrink: true,
            },
            {
                id: 'body', name: 'Texto principal', type: 'text', x: 110, y: 254, w: W - 220, h: 64,
                content:
                    'por haver concluído com êxito o curso de {{curso.nome}}{{#if curso.cargaHoraria}}, com carga horária de {{curso.cargaHoraria}}{{/if}}, realizado {{curso.periodo}}.',
                font: 'Times', size: 14, bold: false, italic: false, color: '$text', align: 'center', valign: 'top', lineGap: 4, autoShrink: true,
            },
            {
                id: 'issue', name: 'Local e data', type: 'text', x: 100, y: 326, w: W - 200, h: 18,
                content: '{{#if curso.local}}{{curso.local}}, {{/if}}{{certificado.emissaoExtenso}}{{#if certificado.validade}} · válido até {{certificado.validade}}{{/if}}',
                font: 'Times', size: 12, bold: false, italic: true, color: '$muted', align: 'center', valign: 'top', autoShrink: true,
            },
            {
                id: 'signature-academy', name: 'Assinatura da academia', type: 'signature', source: 'template', x: 110, y: H - 215, w: 220, h: 84,
                role: 'Direção', lineColor: '$accent', nameColor: '$text', roleColor: '$muted', font: 'Times',
            },
            {
                id: 'signature-student', name: 'Assinatura do aluno', type: 'signature', source: 'student', x: W - 330, y: H - 215, w: 220, h: 84,
                role: 'Aluno(a)', lineColor: '$accent', nameColor: '$text', roleColor: '$muted', font: 'Times',
            },
            { id: 'seal', name: 'Selo', type: 'seal', x: W / 2 - 40, y: H - 220, w: 80, h: 108, color: '$primary', ringColor: '$accent', ribbonColor: '$accent', showRibbon: true, content: 'logo' },
            { id: 'qrcode', name: 'QR de validação', type: 'qrcode', x: W - 150, y: 46, w: 100, h: 104, showCode: true, color: '$primary', labelColor: '$muted' },
        ],
    };
}

export function getLayoutPresets(): LayoutPreset[] {
    return [
        { id: 'classic', name: 'Clássico', description: 'Selo com fita, faixa com o nome do curso e moldura dupla.', layout: buildClassicLayout() },
        { id: 'modern', name: 'Moderno', description: 'Faixa lateral com a logo, título grande alinhado à esquerda.', layout: buildModernLayout() },
        { id: 'elegant', name: 'Elegante', description: 'Fonte serifada, moldura fina e selo centralizado.', layout: buildElegantLayout() },
    ];
}
