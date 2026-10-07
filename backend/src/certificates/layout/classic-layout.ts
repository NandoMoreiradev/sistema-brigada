// backend/src/certificates/layout/classic-layout.ts
//
// Layout "Clássico": o certificado que o sistema gerava antes de existir layout
// configurável (inspirado num certificado físico de brigada que o cliente trouxe:
// selo com fita, ornamentos de canto, faixa com o nome do curso, moldura dupla,
// duas assinaturas). Academia sem layout salvo usa este. As posições são as mesmas
// do desenho antigo, para quem não mexer em nada ver o mesmo papel.

import { CertificateLayout, LAYOUT_VERSION, PAGE_SIZE } from './certificate-layout.types';
import { buildClassicBackPage } from './back-pages';

const { width: W, height: H } = PAGE_SIZE.landscape;
const LINE_MUTED = '#ADB5BD';

export function buildClassicLayout(): CertificateLayout {
    const signatureLineY = H - 170;
    return {
        version: LAYOUT_VERSION,
        orientation: 'landscape',
        theme: {
            primary: '#1B2A4A',
            primaryLight: '#3A4F7A',
            accent: '#C9A227',
            accentLight: '#E4C465',
            text: '#212529',
            muted: '#6C757D',
        },
        background: { color: '#FFFFFF', imageUrl: null },
        backPage: buildClassicBackPage(),
        elements: [
            { id: 'frame-outer', name: 'Moldura externa', type: 'shape', shape: 'rect', x: 20, y: 20, w: W - 40, h: H - 40, stroke: '$accent', strokeWidth: 1.5, fill: null },
            { id: 'frame-inner', name: 'Moldura interna', type: 'shape', shape: 'rect', x: 28, y: 28, w: W - 56, h: H - 56, stroke: '$primary', strokeWidth: 1, fill: null },
            { id: 'ornament-tl', name: 'Ornamento superior', type: 'ornament', corner: 'top-left', x: 0, y: 0, w: 130, h: 130, color: '$primary', accentColor: '$accentLight' },
            { id: 'ornament-br', name: 'Ornamento inferior', type: 'ornament', corner: 'bottom-right', x: W - 130, y: H - 130, w: 130, h: 130, color: '$primary', accentColor: '$accentLight' },
            { id: 'seal', name: 'Selo', type: 'seal', x: 53, y: 58, w: 84, h: 114, color: '$primary', ringColor: '$accent', ribbonColor: '$primaryLight', showRibbon: true, content: 'logo' },
            {
                id: 'title', name: 'Título', type: 'text', x: 170, y: 48, w: 420, h: 40,
                content: 'CERTIFICADO', font: 'Helvetica', size: 32, bold: true, italic: false, color: '$primary', align: 'left', valign: 'top', autoShrink: true,
            },
            {
                id: 'organization', name: 'Nome da academia', type: 'text', x: 170, y: 92, w: 420, h: 16,
                content: '{{academia.nome}}', font: 'Helvetica', size: 11, bold: false, italic: false, color: '$muted', align: 'left', valign: 'top', uppercase: true, autoShrink: true,
            },
            { id: 'banner-top', name: 'Faixa (filete superior)', type: 'shape', shape: 'rect', x: 70, y: 148, w: W - 140, h: 2.5, fill: '$accent', stroke: null, strokeWidth: 0 },
            { id: 'banner', name: 'Faixa', type: 'shape', shape: 'rect', x: 70, y: 150.5, w: W - 140, h: 37, fill: '$primary', stroke: null, strokeWidth: 0 },
            { id: 'banner-bottom', name: 'Faixa (filete inferior)', type: 'shape', shape: 'rect', x: 70, y: 187.5, w: W - 140, h: 2.5, fill: '$accent', stroke: null, strokeWidth: 0 },
            {
                id: 'course-name', name: 'Nome do curso', type: 'text', x: 90, y: 150.5, w: W - 180, h: 37,
                content: '{{curso.nome}}', font: 'Helvetica', size: 15, bold: true, italic: false, color: '#FFFFFF', align: 'center', valign: 'middle', uppercase: true, autoShrink: true,
            },
            {
                id: 'intro', name: 'Abertura', type: 'text', x: 80, y: 218, w: W - 160, h: 18,
                content: 'Certificamos que', font: 'Helvetica', size: 13, bold: false, italic: false, color: '$text', align: 'center', valign: 'top', autoShrink: true,
            },
            {
                id: 'student-name', name: 'Nome do aluno', type: 'text', x: 80, y: 240, w: W - 160, h: 30,
                content: '{{aluno.nome}}', font: 'Helvetica', size: 22, bold: true, italic: false, color: '$primary', align: 'center', valign: 'middle', autoShrink: true,
            },
            {
                id: 'body', name: 'Texto principal', type: 'text', x: 80, y: 276, w: W - 160, h: 44,
                content:
                    'concluiu com aproveitamento o curso "{{curso.nome}}"{{#if curso.cargaHoraria}}, com carga horária de {{curso.cargaHoraria}}{{/if}}{{#if curso.local}}, realizado em {{curso.local}}{{/if}}, em {{certificado.emissao}}.',
                font: 'Helvetica', size: 13, bold: false, italic: false, color: '$text', align: 'center', valign: 'top', lineGap: 3, autoShrink: true,
            },
            {
                id: 'validity', name: 'Validade', type: 'text', x: 80, y: 324, w: W - 160, h: 16,
                content: '{{#if certificado.validade}}Validade: até {{certificado.validade}}.{{/if}}', font: 'Helvetica', size: 11, bold: false, italic: false, color: '$muted', align: 'center', valign: 'top', autoShrink: true,
            },
            {
                id: 'signature-student', name: 'Assinatura do aluno', type: 'signature', source: 'student', x: 80, y: signatureLineY - 50, w: 220, h: 84,
                role: 'Aluno(a)', lineColor: LINE_MUTED, nameColor: '$text', roleColor: '$muted',
            },
            {
                id: 'signature-academy', name: 'Assinatura da academia', type: 'signature', source: 'template', x: 360, y: signatureLineY - 50, w: 220, h: 84,
                role: 'Instrutor(a) responsável', lineColor: LINE_MUTED, nameColor: '$text', roleColor: '$muted',
            },
            { id: 'qrcode', name: 'QR de validação', type: 'qrcode', x: W - 185, y: H - 215, w: 130, h: 124, showCode: true, color: '#000000', labelColor: '$muted' },
        ],
    };
}
