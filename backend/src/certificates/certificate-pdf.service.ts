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
// Cuidados com o pdfkit que já causaram bug aqui:
// - `text()` sem `height` que passa da margem inferior abre uma página nova sozinho.
//   Todo texto da 1ª página é desenhado com `height` (corta em vez de quebrar página).
// - Na página de conteúdo programático é o contrário: o texto PRECISA fluir para
//   páginas novas (não tem tamanho previsível); o listener `pageAdded` redesenha o
//   fundo e a moldura em cada página extra.

import { Injectable, Logger } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import * as QRCode from 'qrcode';
import {
    CertificateLayout,
    ColorValue,
    FontFamily,
    ImageElement,
    LayoutElement,
    OrnamentElement,
    PAGE_SIZE,
    QrCodeElement,
    SealElement,
    ShapeElement,
    SignatureElement,
    TextElement,
} from './layout/certificate-layout.types';
import { CertificateVariables, renderCertificateText } from './layout/certificate-layout-variables';

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

const FONT_NAMES: Record<FontFamily, [regular: string, bold: string, italic: string, boldItalic: string]> = {
    Helvetica: ['Helvetica', 'Helvetica-Bold', 'Helvetica-Oblique', 'Helvetica-BoldOblique'],
    Times: ['Times-Roman', 'Times-Bold', 'Times-Italic', 'Times-BoldItalic'],
    Courier: ['Courier', 'Courier-Bold', 'Courier-Oblique', 'Courier-BoldOblique'],
};

const fontName = (family: FontFamily, bold: boolean, italic: boolean) => FONT_NAMES[family][(bold ? 1 : 0) + (italic ? 2 : 0)];

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

            this.drawBackground(doc, layout, images, width, height);
            for (const element of layout.elements) {
                if (element.hidden) continue;
                doc.save();
                if (element.opacity !== undefined && element.opacity < 1) doc.opacity(element.opacity);
                if (element.rotation) {
                    doc.rotate(element.rotation, { origin: [element.x + element.w / 2, element.y + element.h / 2] });
                }
                try {
                    this.drawElement(doc, element, input, images, qrCodes, color);
                } catch (error) {
                    // Um elemento com problema (imagem corrompida...) não derruba o certificado inteiro.
                    this.logger.warn(`Elemento "${element.id}" não pôde ser desenhado: ${error.message}`);
                }
                doc.restore();
            }

            const syllabus = input.syllabus?.trim();
            if (layout.syllabusPage.enabled && syllabus) {
                this.drawSyllabusPages(doc, input, syllabus, images, width, height, color);
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
        for (const element of layout.elements) {
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

    private async renderQrCodes(layout: CertificateLayout, url: string): Promise<Map<string, Buffer>> {
        const colors = new Set(
            layout.elements.filter((e): e is QrCodeElement => e.type === 'qrcode' && !e.hidden).map((e) => this.resolveColor(e.color, layout) ?? '#000000'),
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

    private drawBackground(doc: Doc, layout: CertificateLayout, images: Map<string, Buffer | null>, width: number, height: number) {
        const background = this.resolveColor(layout.background.color, layout);
        if (background && background.toUpperCase() !== '#FFFFFF') {
            doc.rect(0, 0, width, height).fill(background);
        }
        if (layout.background.imageUrl) {
            this.image(doc, images.get(layout.background.imageUrl), 0, 0, width, height, 'cover');
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

        doc.font(fontName(element.font, element.bold, element.italic));
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
        doc.font(fontName(family, true, false)).fontSize(nameSize);
        while (nameSize > 8 && doc.widthOfString(name) > w) doc.fontSize((nameSize -= 0.5));
        doc.fillColor(color(element.nameColor) ?? '#212529')
            .text(name, x, lineY + 6, { width: w, height: 14, align: 'center', ellipsis: true });
        const role = renderCertificateText(element.role, input.variables);
        if (role) {
            doc.font(fontName(family, false, false)).fontSize(9).fillColor(color(element.roleColor) ?? '#6C757D')
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

    // ------------------------------------------------------------------ conteúdo programático

    /**
     * Texto livre (não a grade de 3 colunas da referência) — turmas de brigada variam
     * demais de formato pra uma estrutura rígida valer a pena (decisão 17).
     */
    private drawSyllabusPages(
        doc: Doc,
        input: CertificateRenderInput,
        syllabus: string,
        images: Map<string, Buffer | null>,
        width: number,
        height: number,
        color: (value: ColorValue) => string | null,
    ) {
        const decorate = () => {
            // O rodapé abaixo é um text() e move o cursor; sem restaurar, o texto que está
            // quebrando de página continuaria do rodapé — e quebraria página de novo, sem fim.
            const cursor = { x: doc.x, y: doc.y };
            this.drawBackground(doc, input.layout, images, width, height);
            doc.rect(20, 20, width - 40, height - 40).lineWidth(1.5).strokeColor(color('$accent') ?? '#C9A227').stroke();
            doc.rect(28, 28, width - 56, height - 56).lineWidth(1).strokeColor(color('$primary') ?? '#1B2A4A').stroke();
            doc.font('Helvetica').fontSize(7).fillColor(color('$muted') ?? '#6C757D').text(
                `Certificado ${input.verification.code} · valide em ${input.verification.pageUrl}`,
                40,
                height - 44,
                { width: width - 80, height: 10, align: 'center' },
            );
            // Este listener roda NO MEIO da quebra de página do texto do conteúdo programático:
            // fonte e cor são estado do pdfkit e seguiriam no resto do texto. Restaura as dele.
            doc.font('Helvetica').fontSize(11).fillColor(color('$text') ?? '#212529');
            doc.x = cursor.x;
            doc.y = cursor.y;
        };

        doc.on('pageAdded', decorate);
        doc.addPage({ size: [width, height], margin: 50 });

        doc.font('Helvetica-Bold').fontSize(26).fillColor(color('$accent') ?? '#C9A227')
            .text(input.layout.syllabusPage.title, 60, 55, { width: width - 120, height: 32, align: 'center' });
        doc.font('Helvetica').fontSize(12).fillColor(color('$muted') ?? '#6C757D')
            .text(input.variables['curso.nome'] ?? '', 60, 90, { width: width - 120, height: 16, align: 'center' });

        // Sem `height` de propósito: o texto flui para páginas novas (ver comentário no topo).
        doc.font('Helvetica').fontSize(11).fillColor(color('$text') ?? '#212529').text(syllabus, 90, 140, {
            width: width - 180,
            align: 'left',
            lineGap: 4,
        });
    }
}
