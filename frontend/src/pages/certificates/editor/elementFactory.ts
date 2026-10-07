// frontend/src/pages/certificates/editor/elementFactory.ts
//
// Elementos novos (botões "Adicionar" do editor), já centralizados na página e
// com cores do tema — assim acompanham a paleta se ela mudar depois.

import { PAGE_SIZE, type CertificateLayout, type LayoutElement } from '../layout/types';
import { newId } from './layoutUtils';

export type NewElementKind = 'text' | 'variable-text' | 'image' | 'signature' | 'qrcode' | 'rect' | 'ellipse' | 'line' | 'seal' | 'ornament';

export const NEW_ELEMENT_OPTIONS: Array<{ kind: NewElementKind; label: string }> = [
    { kind: 'text', label: 'Texto' },
    { kind: 'variable-text', label: 'Nome do aluno' },
    { kind: 'image', label: 'Imagem' },
    { kind: 'signature', label: 'Assinatura' },
    { kind: 'qrcode', label: 'QR de validação' },
    { kind: 'rect', label: 'Retângulo' },
    { kind: 'ellipse', label: 'Círculo' },
    { kind: 'line', label: 'Linha' },
    { kind: 'seal', label: 'Selo' },
    { kind: 'ornament', label: 'Ornamento' },
];

export function createElement(kind: NewElementKind, layout: CertificateLayout): LayoutElement {
    const page = PAGE_SIZE[layout.orientation];
    const centered = (w: number, h: number) => ({ id: newId(), x: Math.round((page.width - w) / 2), y: Math.round((page.height - h) / 2), w, h });

    switch (kind) {
        case 'text':
            return {
                ...centered(300, 30), type: 'text', content: 'Novo texto', font: 'Helvetica', size: 14, bold: false, italic: false,
                color: '$text', align: 'center', valign: 'top', autoShrink: true,
            };
        case 'variable-text':
            return {
                ...centered(400, 40), name: 'Nome do aluno', type: 'text', content: '{{aluno.nome}}', font: 'Helvetica', size: 24, bold: true, italic: false,
                color: '$primary', align: 'center', valign: 'middle', autoShrink: true,
            };
        case 'image':
            return { ...centered(120, 120), type: 'image', source: 'logo', url: null, fit: 'contain' };
        case 'signature':
            return {
                ...centered(220, 84), type: 'signature', source: 'custom', signerName: 'Nome de quem assina', role: 'Cargo', imageUrl: null,
                lineColor: '#ADB5BD', nameColor: '$text', roleColor: '$muted', font: 'Helvetica',
            };
        case 'qrcode':
            return { ...centered(130, 124), type: 'qrcode', showCode: true, color: '#000000', labelColor: '$muted' };
        case 'rect':
            return { ...centered(200, 100), type: 'shape', shape: 'rect', fill: '$primaryLight', stroke: null, strokeWidth: 0, radius: 0 };
        case 'ellipse':
            return { ...centered(100, 100), type: 'shape', shape: 'ellipse', fill: '$accentLight', stroke: null, strokeWidth: 0 };
        case 'line':
            return { ...centered(200, 0), type: 'shape', shape: 'line', fill: null, stroke: '$accent', strokeWidth: 2 };
        case 'seal':
            return { ...centered(84, 114), type: 'seal', color: '$primary', ringColor: '$accent', ribbonColor: '$primaryLight', showRibbon: true, content: 'logo' };
        case 'ornament':
            return { id: newId(), x: 0, y: 0, w: 130, h: 130, type: 'ornament', corner: 'top-left', color: '$primary', accentColor: '$accentLight' };
    }
}

/** Cópia deslocada (Ctrl+D), com id novo. */
export function duplicateElement(element: LayoutElement): LayoutElement {
    return { ...element, id: newId(), x: element.x + 12, y: element.y + 12, name: element.name ? `${element.name} (cópia)` : undefined, locked: false };
}
