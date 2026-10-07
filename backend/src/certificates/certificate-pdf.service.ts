// backend/src/certificates/certificate-pdf.service.ts
//
// Geração server-side do PDF do certificado a partir de um layout
// (layout/certificate-layout.types.ts): cada elemento é desenhado na ordem da
// lista. Usa `pdfkit` (puro Node, sem navegador — roda sem configuração extra no
// Railway) + `qrcode` para o QR de validação (/validar/:code).
//
// Academia sem layout salvo usa o "Clássico" (layout/classic-layout.ts), que
// reproduz o desenho fixo que existia antes desta versão.
//
// Cuidado com o pdfkit que já causou bug aqui: `text()` sem `height` que passa da
// margem inferior abre uma página nova sozinho. Todo texto é desenhado com `height`
// (corta em vez de quebrar página). O conteúdo programático do verso, que não tem
// tamanho previsível, é dividido em colunas/páginas ANTES de desenhar, medindo com o
// próprio pdfkit (paginateSyllabus); cada página extra repete o desenho do verso.

import { Injectable, Logger } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import * as QRCode from 'qrcode';
import {
    CertificateLayout,
    ColorValue,
    ImageElement,
    LayoutElement,
    OrnamentElement,
    PAGE_SIZE,
    QrCodeElement,
    SealElement,
    ShapeElement,
    SignatureElement,
    SyllabusElement,
    TextElement,
} from './layout/certificate-layout.types';
import { CertificateVariables, renderCertificateText } from './layout/certificate-layout-variables';
import { FontFamily, resolveFont } from './layout/certificate-fonts';

/** Uma URL de imagem lenta não pode segurar a emissão: depois disso segue sem a imagem. */
const IMAGE_FETCH_TIMEOUT_MS = 8000;
const MIN_FONT_SIZE = 5;

export interface CertificateRenderInput {
    layout: CertificateLayout;
    variables: CertificateVariables;
    /** Personalização da academia, usada pelos elementos com source 'logo'/'template' */
    brand: {
        organizationName: string;
        logoUrl?: string | null;
        signatureName?: string | null;
        signatureImageUrl?: string | null;
    };
    verification: {
        /** URL completa que o QR abre */
        url: string;
        /** Código já formatado (XXXX-XXXX-XXXX) */
        code: string;
        /** Endereço da página de validação, sem protocolo — para ler e digitar */
        pageUrl: string;
    };
    syllabus?: string | null;
}

type Doc = PDFKit.PDFDocument;

/** O que cada página precisa para desenhar (frente ou verso). */
interface PageContext {
    doc: Doc;
    input: CertificateRenderInput;
    images: Map<string, Buffer | null>;
    qrCodes: Map<string, Buffer>;
    color: (value: ColorValue | null | undefined) => string | null;
    width: number;
    height: number;
}

interface PageBackground {
    color: ColorValue;
    imageUrl?: string | null;
}

/** Pedaço do conteúdo programático de uma página do verso, já dividido em colunas. */
interface SyllabusPageChunk {
    size: number;
    columns: string[];
}

/** Proteção contra ementa gigante colada por engano (um certificado com dezenas de páginas). */
const MAX_SYLLABUS_PAGES = 10;

/** Seleciona a fonte no documento, registrando o arquivo na 1ª vez quando é uma fonte embutida. */
function useFont(doc: Doc, family: FontFamily, bold: boolean, italic: boolean) {
    const font = resolveFont(family, bold, italic);
    if (font.file) {
        const registered = ((doc as Doc & { _certificateFonts?: Set<string> })._certificateFonts ??= new Set<string>());
        if (!registered.has(font.name)) {
            doc.registerFont(font.name, font.file);
            registered.add(font.name);
        }
    }
    return doc.font(font.name);
}

@Injectable()
export class CertificatePdfService {
    private readonly logger = new Logger(CertificatePdfService.name);

    async generate(input: CertificateRenderInput): Promise<Buffer> {
        const { layout } = input;
        const images = await this.loadImages(input);
        const qrCodes = await this.renderQrCodes(layout, input.verification.url);

        return new Promise<Buffer>((resolve, reject) => {
            const { width, height } = PAGE_SIZE[layout.orientation];
            const doc = new PDFDocument({ size: [width, height], margin: 50, autoFirstPage: true });
            const chunks: Buffer[] = [];
            doc.on('data', (chunk) => chunks.push(chunk));
            doc.on('end', () => resolve(Buffer.concat(chunks)));
            doc.on('error', reject);

            doc.info.Title = `Certificado — ${input.variables['aluno.nome'] ?? ''} — ${input.variables['curso.nome'] ?? ''}`;
            doc.info.Author = input.brand.organizationName;

            const color = (value: ColorValue | null | undefined) => this.resolveColor(value, layout);

            const page: PageContext = { doc, input, images, qrCodes, color, width, height };
            this.drawPage(page, layout.background, layout.elements, null);

            const back = layout.backPage;
            const syllabus = input.syllabus?.trim() ?? '';
            if (back.enabled && (syllabus || !back.onlyWithSyllabus)) {
                this.drawBackPages(page, syllabus);
            }

            doc.end();
        }).catch((error) => {
            this.logger.error(`Falha ao gerar PDF do certificado: ${error.message}`, error.stack);
            throw error;
        });
    }

    private resolveColor(value: ColorValue | null | undefined, layout: CertificateLayout): string | null {
        if (!value) return null;
        if (value.startsWith('$')) return layout.theme[value.slice(1) as keyof CertificateLayout['theme']] ?? '#000000';
        return value;
    }

    // ------------------------------------------------------------------ imagens

    /** Baixa todas as imagens que o layout usa, em paralelo, uma vez cada. */
    private async loadImages(input: CertificateRenderInput): Promise<Map<string, Buffer | null>> {
        const { layout, brand } = input;
        const urls = new Set<string>();
        const add = (url: string | null | undefined) => url && urls.add(url);

        add(layout.background.imageUrl);
        add(layout.backPage.enabled ? layout.backPage.background.imageUrl : null);
        for (const element of this.allElements(layout)) {
            if (element.hidden) continue;
            if (element.type === 'image') add(element.source === 'logo' ? brand.logoUrl : element.url);
            if (element.type === 'seal' && element.content === 'logo') add(brand.logoUrl);
            if (element.type === 'signature') add(element.source === 'template' ? brand.signatureImageUrl : element.source === 'custom' ? element.imageUrl : null);
        }

        const entries = await Promise.all([...urls].map(async (url) => [url, await this.fetchImageBuffer(url)] as const));
        return new Map(entries);
    }

    /** Best-effort: uma URL de imagem fora do ar não pode derrubar a emissão do certificado. */
    private async fetchImageBuffer(url: string): Promise<Buffer | null> {
        try {
            const response = await fetch(url, { signal: AbortSignal.timeout(IMAGE_FETCH_TIMEOUT_MS) });
            if (!response.ok) return null;
            return Buffer.from(await response.arrayBuffer());
        } catch (error) {
            this.logger.warn(`Não foi possível baixar imagem para o certificado (${url}): ${error.message}`);
            return null;
        }
    }

    private allElements(layout: CertificateLayout): LayoutElement[] {
        return layout.backPage.enabled ? [...layout.elements, ...layout.backPage.elements] : layout.elements;
    }

    private async renderQrCodes(layout: CertificateLayout, url: string): Promise<Map<string, Buffer>> {
        const colors = new Set(
            this.allElements(layout).filter((e): e is QrCodeElement => e.type === 'qrcode' && !e.hidden).map((e) => this.resolveColor(e.color, layout) ?? '#000000'),
        );
        const entries = await Promise.all(
            [...colors].map(async (dark) => [dark, await QRCode.toBuffer(url, { margin: 1, width: 300, color: { dark, light: '#FFFFFF' } })] as const),
        );
        return new Map(entries);
    }

    private image(doc: Doc, buffer: Buffer | null | undefined, x: number, y: number, w: number, h: number, fit: ImageElement['fit'] = 'contain'): boolean {
        if (!buffer || w <= 0 || h <= 0) return false;
        try {
            if (fit === 'stretch') {
                doc.image(buffer, x, y, { width: w, height: h });
            } else if (fit === 'cover') {
                doc.save();
                doc.rect(x, y, w, h).clip();
                doc.image(buffer, x, y, { cover: [w, h], align: 'center', valign: 'center' });
                doc.restore();
            } else {
                doc.image(buffer, x, y, { fit: [w, h], align: 'center', valign: 'center' });
            }
            return true;
        } catch {
            // Formato não suportado pelo pdfkit (ex.: SVG, WebP) ou arquivo corrompido.
            return false;
        }
    }

    // ------------------------------------------------------------------ página

    /**
     * Fundo + elementos de uma página. `syllabus`: o pedaço do conteúdo programático
     * que cabe nesta página, já dividido por coluna (só no verso).
     */
    private drawPage(page: PageContext, background: PageBackground, elements: LayoutElement[], syllabus: SyllabusPageChunk | null) {
        const { doc, images, width, height, color } = page;
        const backgroundColor = color(background.color);
        if (backgroundColor && backgroundColor.toUpperCase() !== '#FFFFFF') {
            doc.rect(0, 0, width, height).fill(backgroundColor);
        }
        if (background.imageUrl) {
            this.image(doc, images.get(background.imageUrl), 0, 0, width, height, 'cover');
        }

        for (const element of elements) {
            if (element.hidden) continue;
            doc.save();
            if (element.opacity !== undefined && element.opacity < 1) doc.opacity(element.opacity);
            if (element.rotation) {
                doc.rotate(element.rotation, { origin: [element.x + element.w / 2, element.y + element.h / 2] });
            }
            try {
                if (element.type === 'syllabus') {
                    if (syllabus) this.drawSyllabusColumns(doc, element, syllabus, color);
                } else {
                    this.drawElement(doc, element, page.input, images, page.qrCodes, color);
                }
            } catch (error) {
                // Um elemento com problema (imagem corrompida...) não derruba o certificado inteiro.
                this.logger.warn(`Elemento "${element.id}" não pôde ser desenhado: ${error.message}`);
            }
            doc.restore();
        }
    }

    private drawElement(
        doc: Doc,
        element: LayoutElement,
        input: CertificateRenderInput,
        images: Map<string, Buffer | null>,
        qrCodes: Map<string, Buffer>,
        color: (value: ColorValue | null | undefined) => string | null,
    ) {
        switch (element.type) {
            case 'text':
                return this.drawText(doc, element, renderCertificateText(element.content, input.variables), color);
            case 'image':
                return this.image(doc, images.get((element.source === 'logo' ? input.brand.logoUrl : element.url) ?? ''), element.x, element.y, element.w, element.h, element.fit);
            case 'signature':
                return this.drawSignature(doc, element, input, images, color);
            case 'qrcode':
                return this.drawQrCode(doc, element, input, qrCodes.get(color(element.color) ?? '#000000'), color);
            case 'shape':
                return this.drawShape(doc, element, color);
            case 'seal':
                return this.drawSeal(doc, element, input, images, color);
            case 'ornament':
                return this.drawOrnament(doc, element, color);
        }
    }

    // ------------------------------------------------------------------ elementos

    /** Texto dentro da caixa: alinhamento vertical, e fonte reduzida até caber quando `autoShrink`. */
    private drawText(doc: Doc, element: TextElement, rawText: string, color: (value: ColorValue) => string | null) {
        const text = element.uppercase ? rawText.toLocaleUpperCase('pt-BR') : rawText;
        if (!text.trim() || element.w <= 0 || element.h <= 0) return;

        useFont(doc, element.font, element.bold, element.italic);
        const options = {
            width: element.w,
            align: element.align,
            lineGap: element.lineGap ?? 0,
            characterSpacing: element.letterSpacing ?? 0,
        };

        let size = element.size;
        doc.fontSize(size);
        if (element.autoShrink) {
            while (size > MIN_FONT_SIZE && doc.heightOfString(text, options) > element.h) {
                size = Math.max(MIN_FONT_SIZE, size - 0.5);
                doc.fontSize(size);
            }
        }

        const textHeight = Math.min(doc.heightOfString(text, options), element.h);
        const offset = element.valign === 'middle' ? (element.h - textHeight) / 2 : element.valign === 'bottom' ? element.h - textHeight : 0;
        doc.fillColor(color(element.color) ?? '#000000').text(text, element.x, element.y + offset, {
            ...options,
            height: element.h - offset,
            ellipsis: true,
        });
    }

    /**
     * Linha de assinatura com nome e cargo embaixo e, se houver, a imagem da assinatura
     * acima da linha. A do aluno é sempre linha em branco: o sistema não captura
     * assinatura digital do aluno (o certificado é impresso e assinado à mão).
     */
    private drawSignature(
        doc: Doc,
        element: SignatureElement,
        input: CertificateRenderInput,
        images: Map<string, Buffer | null>,
        color: (value: ColorValue) => string | null,
    ) {
        const { x, y, w, h } = element;
        const lineY = y + h - 34;
        let name: string;
        let imageUrl: string | null | undefined;
        if (element.source === 'student') {
            name = input.variables['aluno.nome'] ?? '';
        } else if (element.source === 'template') {
            name = input.brand.signatureName || 'Direção da Academia';
            imageUrl = input.brand.signatureImageUrl;
        } else {
            name = renderCertificateText(element.signerName ?? '', input.variables);
            imageUrl = element.imageUrl;
        }

        if (imageUrl) {
            const imageW = Math.min(w * 0.6, 140);
            this.image(doc, images.get(imageUrl), x + (w - imageW) / 2, y, imageW, Math.max(0, lineY - y - 4));
        }

        doc.moveTo(x, lineY).lineTo(x + w, lineY).lineWidth(1).strokeColor(color(element.lineColor) ?? '#ADB5BD').stroke();
        // Nome numa linha só: diminui até 8pt antes de cortar com reticências.
        const family = element.font ?? 'Helvetica';
        let nameSize = 11;
        useFont(doc, family, true, false).fontSize(nameSize);
        while (nameSize > 8 && doc.widthOfString(name) > w) doc.fontSize((nameSize -= 0.5));
        doc.fillColor(color(element.nameColor) ?? '#212529')
            .text(name, x, lineY + 6, { width: w, height: 14, align: 'center', ellipsis: true });
        const role = renderCertificateText(element.role, input.variables);
        if (role) {
            useFont(doc, family, false, false).fontSize(9).fillColor(color(element.roleColor) ?? '#6C757D')
                .text(role, x, lineY + 22, { width: w, height: 12, align: 'center', ellipsis: true });
        }
    }

    private drawQrCode(
        doc: Doc,
        element: QrCodeElement,
        input: CertificateRenderInput,
        qrBuffer: Buffer | undefined,
        color: (value: ColorValue) => string | null,
    ) {
        if (!qrBuffer) return;
        const { x, y, w, h } = element;
        const labelsHeight = element.showCode ? 34 : 0;
        const size = Math.max(0, Math.min(w, h - labelsHeight));
        doc.image(qrBuffer, x + (w - size) / 2, y, { width: size });
        if (!element.showCode) return;

        const labelColor = color(element.labelColor) ?? '#6C757D';
        const top = y + size + 3;
        doc.font('Helvetica').fontSize(7).fillColor(labelColor).text('Código de verificação', x, top, { width: w, height: 9, align: 'center' });
        doc.font('Helvetica-Bold').fontSize(9).fillColor(color('$primary') ?? '#000000')
            .text(input.verification.code, x, top + 9, { width: w, height: 11, align: 'center' });
        doc.font('Helvetica').fontSize(7).fillColor(labelColor)
            .text(`Valide em ${input.verification.pageUrl}`, x, top + 20, { width: w, height: 18, align: 'center', ellipsis: true });
    }

    private drawShape(doc: Doc, element: ShapeElement, color: (value: ColorValue | null | undefined) => string | null) {
        const fill = color(element.fill);
        const stroke = element.strokeWidth > 0 ? color(element.stroke) : null;
        if (!fill && !stroke) return;
        const { x, y, w, h } = element;

        if (element.shape === 'line') {
            if (!stroke) return;
            doc.moveTo(x, y).lineTo(x + w, y + h).lineWidth(element.strokeWidth).strokeColor(stroke).stroke();
            return;
        }

        if (element.shape === 'ellipse') doc.ellipse(x + w / 2, y + h / 2, w / 2, h / 2);
        else if (element.radius) doc.roundedRect(x, y, w, h, element.radius);
        else doc.rect(x, y, w, h);

        if (stroke) doc.lineWidth(element.strokeWidth);
        if (fill && stroke) doc.fillAndStroke(fill, stroke);
        else if (fill) doc.fill(fill);
        else doc.stroke(stroke!);
    }

    /** Selo recortado (rosette) com a logo da academia dentro, ou as iniciais do nome se não houver logo. */
    private drawSeal(
        doc: Doc,
        element: SealElement,
        input: CertificateRenderInput,
        images: Map<string, Buffer | null>,
        color: (value: ColorValue) => string | null,
    ) {
        const outerR = element.w / 2;
        const innerR = outerR * (34 / 42);
        const cx = element.x + outerR;
        const cy = element.y + outerR;
        const teeth = 18;
        const points: [number, number][] = [];
        for (let i = 0; i < teeth * 2; i++) {
            const r = i % 2 === 0 ? outerR : innerR;
            const angle = (Math.PI * i) / teeth;
            points.push([cx + r * Math.sin(angle), cy - r * Math.cos(angle)]);
        }

        // Fita primeiro, para ficar atrás do selo.
        if (element.showRibbon) {
            const ribbonW = outerR * (26 / 42);
            const ribbonTop = cy + innerR - outerR * (8 / 42);
            const ribbonBottom = Math.min(element.y + element.h, ribbonTop + outerR * (46 / 42));
            doc.polygon(
                [cx - ribbonW / 2, ribbonTop],
                [cx + ribbonW / 2, ribbonTop],
                [cx + ribbonW / 2, ribbonBottom],
                [cx, ribbonBottom - outerR * (14 / 42)],
                [cx - ribbonW / 2, ribbonBottom],
            ).fill(color(element.ribbonColor) ?? '#3A4F7A');
        }

        doc.polygon(...points).fill(color(element.color) ?? '#1B2A4A');
        const ringColor = color(element.ringColor) ?? '#C9A227';
        doc.circle(cx, cy, innerR - outerR * (6 / 42)).lineWidth(1.5).fillAndStroke('#FFFFFF', ringColor);

        const logoSize = outerR * (44 / 42);
        const drewLogo =
            element.content === 'logo' &&
            this.image(doc, images.get(input.brand.logoUrl ?? ''), cx - logoSize / 2, cy - logoSize / 2, logoSize, logoSize);
        if (!drewLogo) {
            const initials = input.brand.organizationName
                .split(/\s+/)
                .filter((word) => /^[\p{L}\d]/u.test(word))
                .slice(0, 2)
                .map((word) => word[0]?.toUpperCase())
                .join('');
            const fontSize = outerR * (18 / 42);
            doc.font('Helvetica-Bold').fontSize(fontSize).fillColor(color(element.color) ?? '#1B2A4A')
                .text(initials, cx - outerR, cy - fontSize / 2, { width: outerR * 2, height: fontSize * 1.3, align: 'center' });
        }
    }

    /** Par de triângulos (cor de destaque por fora, cor principal por dentro) no canto da caixa. */
    private drawOrnament(doc: Doc, element: OrnamentElement, color: (value: ColorValue) => string | null) {
        const { x, y, w, h } = element;
        const left = element.corner.endsWith('left');
        const top = element.corner.startsWith('top');
        const ox = left ? x : x + w;
        const oy = top ? y : y + h;
        const dx = left ? 1 : -1;
        const dy = top ? 1 : -1;
        const inner = 1 - 35 / 130;

        doc.polygon([ox, oy], [ox + dx * w, oy], [ox, oy + dy * h]).fillOpacity(0.9).fill(color(element.accentColor) ?? '#E4C465');
        doc.polygon([ox, oy], [ox + dx * w * inner, oy], [ox, oy + dy * h * inner]).fillOpacity(1).fill(color(element.color) ?? '#1B2A4A');
    }

    // ------------------------------------------------------------------ verso e conteúdo programático

    /**
     * Verso: uma página com o desenho do verso e, se o conteúdo programático não couber
     * na caixa dele, outras páginas iguais com a continuação. Texto livre (não uma grade
     * rígida) — turmas de brigada variam demais de formato (decisão 17).
     */
    private drawBackPages(page: PageContext, syllabus: string) {
        const { doc, input, width, height } = page;
        const back = input.layout.backPage;
        const box = back.elements.find((element): element is SyllabusElement => element.type === 'syllabus' && !element.hidden);
        const chunks: Array<SyllabusPageChunk | null> = box && syllabus ? this.paginateSyllabus(doc, box, syllabus) : [null];

        for (const chunk of chunks) {
            doc.addPage({ size: [width, height], margin: 50 });
            this.drawPage(page, back.background, back.elements, chunk);
        }
    }

    /**
     * Divide o texto em páginas e colunas medindo com o próprio pdfkit (mesma fonte e
     * largura do desenho). Com `autoShrink`, tenta caber em uma página diminuindo a
     * fonte até `minSize` antes de continuar em outra.
     */
    private paginateSyllabus(doc: Doc, box: SyllabusElement, text: string): SyllabusPageChunk[] {
        const sizes: number[] = [];
        if (box.autoShrink) {
            for (let size = box.size; size > box.minSize; size -= 0.5) sizes.push(size);
            sizes.push(Math.min(box.size, box.minSize));
        } else {
            sizes.push(box.size);
        }

        let result: SyllabusPageChunk[] = [];
        for (const size of sizes) {
            result = this.splitIntoPages(doc, box, text, size);
            if (result.length === 1) break;
        }
        if (result.length > MAX_SYLLABUS_PAGES) {
            this.logger.warn(`Conteúdo programático longo demais: cortado em ${MAX_SYLLABUS_PAGES} páginas de verso.`);
            result = result.slice(0, MAX_SYLLABUS_PAGES);
        }
        return result;
    }

    /** Parágrafo por parágrafo e, quando um parágrafo sozinho não cabe numa coluna, palavra por palavra. */
    private splitIntoPages(doc: Doc, box: SyllabusElement, text: string, size: number): SyllabusPageChunk[] {
        useFont(doc, box.font, false, false).fontSize(size);
        const options = { width: this.syllabusColumnWidth(box), lineGap: box.lineGap, align: box.align };
        const fits = (candidate: string) => doc.heightOfString(candidate, options) <= box.h + 0.5;

        const columns: string[] = [];
        const queue = text.replace(/\r\n/g, '\n').split('\n');
        let current: string[] = [];
        const closeColumn = () => {
            columns.push(current.join('\n'));
            current = [];
        };

        while (queue.length) {
            const paragraph = queue.shift()!;
            // Coluna nova não começa com linha em branco.
            if (!current.length && !paragraph.trim()) continue;

            if (fits([...current, paragraph].join('\n'))) {
                current.push(paragraph);
                continue;
            }
            if (current.length) {
                closeColumn();
                queue.unshift(paragraph);
                continue;
            }

            // Parágrafo sozinho maior que a coluna: o máximo de palavras que cabe fica aqui.
            const words = paragraph.split(' ');
            let low = 1;
            let high = words.length - 1;
            let take = 1;
            while (low <= high) {
                const mid = Math.floor((low + high) / 2);
                if (fits(words.slice(0, mid).join(' '))) {
                    take = mid;
                    low = mid + 1;
                } else {
                    high = mid - 1;
                }
            }
            current.push(words.slice(0, take).join(' '));
            closeColumn();
            const rest = words.slice(take).join(' ');
            if (rest) queue.unshift(rest);
        }
        if (current.length) closeColumn();
        if (!columns.length) columns.push('');

        const pages: SyllabusPageChunk[] = [];
        for (let i = 0; i < columns.length; i += box.columns) {
            pages.push({ size, columns: columns.slice(i, i + box.columns) });
        }
        return pages;
    }

    private syllabusColumnWidth(box: SyllabusElement) {
        return Math.max(10, (box.w - box.columnGap * (box.columns - 1)) / box.columns);
    }

    private drawSyllabusColumns(doc: Doc, box: SyllabusElement, chunk: SyllabusPageChunk, color: (value: ColorValue) => string | null) {
        useFont(doc, box.font, false, false).fontSize(chunk.size).fillColor(color(box.color) ?? '#212529');
        const columnWidth = this.syllabusColumnWidth(box);
        chunk.columns.forEach((columnText, index) => {
            if (!columnText) return;
            // Com `height`: o que passar (não deveria — já foi medido) é cortado, nunca abre página sozinho.
            doc.text(columnText, box.x + index * (columnWidth + box.columnGap), box.y, {
                width: columnWidth,
                height: box.h + 1,
                lineGap: box.lineGap,
                align: box.align,
            });
        });
    }
}
