// backend/src/certificates/certificate-pdf.service.ts
//
// Geração server-side do PDF do certificado (docs/decisoes.md: "Construir do
// zero... inspirar no padrão jsPDF existente, mas provavelmente server-side").
// Usa `pdfkit` (puro Node, sem dependência de navegador — ao contrário de
// Puppeteer, roda sem configuração extra no Nixpacks/Railway) + `qrcode`
// (mesma lib já usada pelo 2FA) para o QR de validação, que aponta para a
// página pública do crachá (/badge/:token) — reaproveita a técnica de QR e o
// endpoint público já construídos, em vez de inventar um link de validação
// por certificado.
//
// Layout (2026-09-17) inspirado num certificado físico real de curso de
// brigada que o cliente forneceu como referência: selo recortado (rosette)
// no canto superior esquerdo com fita, ornamentos dourados nos cantos, faixa
// navy com o nome da turma em destaque, moldura dupla, e duas colunas de
// assinatura no rodapé. Simplificação deliberada em relação à referência: a
// assinatura do aluno é sempre uma linha em branco (para assinar após
// imprimir), nunca uma imagem — o sistema não captura assinatura digital do
// aluno.
//
// 2ª página "CONTEÚDO PROGRAMÁTICO" (2026-09-17): só é desenhada quando
// `Course.syllabus` está preenchido. É texto livre (não a grade de 3 colunas
// da referência) — turmas de brigada variam demais de formato pra uma
// estrutura rígida valer a pena (decisão 17); a academia escreve do jeito
// que já usa na ementa impressa dela.

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import PDFDocument from 'pdfkit';
import * as QRCode from 'qrcode';
import { Prisma } from '@prisma/client';

// `Certificate` não tem uma relação Prisma explícita para `Organization` no
// schema (só `organizationId` + índice) — por isso `organization` entra como
// intersecção manual em vez de fazer parte do `include`.
type CertificateForPdf = Prisma.CertificateGetPayload<{
    include: {
        enrollment: {
            include: {
                course: { include: { event: true } };
                studentProfile: { include: { user: true } };
            };
        };
    };
}> & { organization: { name: string } };

interface CertificateTemplateForPdf {
    logoUrl?: string | null;
    signatureName?: string | null;
    signatureImageUrl?: string | null;
}

const NAVY = '#1B2A4A';
const NAVY_LIGHT = '#3A4F7A';
const GOLD = '#C9A227';
const GOLD_LIGHT = '#E4C465';
const TEXT_DARK = '#212529';
const TEXT_MUTED = '#6C757D';
const LINE_MUTED = '#ADB5BD';

@Injectable()
export class CertificatePdfService {
    private readonly logger = new Logger(CertificatePdfService.name);

    constructor(private readonly configService: ConfigService) {}

    async generate(certificate: CertificateForPdf, template: CertificateTemplateForPdf | null): Promise<Buffer> {
        const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:5173';
        const badgeUrl = `${frontendUrl}/badge/${certificate.enrollment.studentProfile.user.publicBadgeToken}`;

        const [qrCodeBuffer, logoBuffer, signatureImageBuffer] = await Promise.all([
            QRCode.toBuffer(badgeUrl, { margin: 1, width: 200 }),
            this.fetchImageBuffer(template?.logoUrl),
            this.fetchImageBuffer(template?.signatureImageUrl),
        ]);

        return new Promise<Buffer>((resolve, reject) => {
            const doc = new PDFDocument({ layout: 'landscape', size: 'A4', margin: 50 });
            const chunks: Buffer[] = [];
            doc.on('data', (chunk) => chunks.push(chunk));
            doc.on('end', () => resolve(Buffer.concat(chunks)));
            doc.on('error', reject);

            const { width, height } = doc.page;

            this.drawBorder(doc, width, height);
            this.drawCornerOrnament(doc, 0, 0, 1);
            this.drawCornerOrnament(doc, width, height, -1);
            this.drawSeal(doc, 95, 100, logoBuffer, certificate.organization.name);
            this.drawHeader(doc, certificate.organization.name);
            this.drawCourseBanner(doc, width, certificate.enrollment.course.event.title);
            this.drawBody(doc, width, certificate);
            this.drawSignatures(doc, width, height, certificate, template, signatureImageBuffer);
            this.drawQrCode(doc, width, height, qrCodeBuffer);

            const syllabus = certificate.enrollment.course.syllabus?.trim();
            if (syllabus) {
                // Conteúdo programático não tem tamanho previsível — em vez de truncar
                // (ver comentário em drawSyllabusPage sobre o bug de overflow já
                // encontrado uma vez), deixa o texto fluir e redesenha a moldura em
                // toda página que o pdfkit adicionar sozinho por causa disso.
                doc.on('pageAdded', () => this.drawBorder(doc, width, height));
                doc.addPage({ layout: 'landscape', size: 'A4', margin: 50 });
                this.drawSyllabusPage(doc, width, height, certificate.enrollment.course.event.title, syllabus, qrCodeBuffer);
            }

            doc.end();
        }).catch((error) => {
            this.logger.error(`Falha ao gerar PDF do certificado ${certificate.id}: ${error.message}`, error.stack);
            throw error;
        });
    }

    /** Best-effort: uma URL de logo/assinatura fora do ar não pode derrubar a emissão do certificado. */
    private async fetchImageBuffer(url: string | null | undefined): Promise<Buffer | null> {
        if (!url) return null;
        try {
            const response = await fetch(url);
            if (!response.ok) return null;
            return Buffer.from(await response.arrayBuffer());
        } catch (error) {
            this.logger.warn(`Não foi possível baixar imagem para o certificado (${url}): ${error.message}`);
            return null;
        }
    }

    /** Moldura dupla: linha dourada externa + linha navy interna, com respiro entre elas. */
    private drawBorder(doc: PDFKit.PDFDocument, width: number, height: number) {
        doc.rect(20, 20, width - 40, height - 40).lineWidth(1.5).strokeColor(GOLD).stroke();
        doc.rect(28, 28, width - 56, height - 56).lineWidth(1).strokeColor(NAVY).stroke();
    }

    /**
     * Par de triângulos dourado+navy no canto, evocando o "swoosh" da
     * referência. `sign` inverte a diagonal (1 = canto superior-esquerdo,
     * -1 = canto inferior-direito) para não precisar duplicar a geometria.
     */
    private drawCornerOrnament(doc: PDFKit.PDFDocument, originX: number, originY: number, sign: 1 | -1) {
        const size = 130;
        const dx = sign;
        const dy = sign;

        doc.save();
        doc.polygon(
            [originX, originY],
            [originX + dx * size, originY],
            [originX, originY + dy * size],
        ).fillOpacity(0.9).fill(GOLD_LIGHT);

        doc.polygon(
            [originX, originY],
            [originX + dx * (size - 35), originY],
            [originX, originY + dy * (size - 35)],
        ).fillOpacity(1).fill(NAVY);
        doc.restore();
    }

    /** Selo recortado (rosette) com a logo da academia dentro, ou as iniciais do nome se não houver logo. */
    private drawSeal(doc: PDFKit.PDFDocument, cx: number, cy: number, logoBuffer: Buffer | null, organizationName: string) {
        const outerR = 42;
        const innerR = 34;
        const teeth = 18;
        const points: [number, number][] = [];
        for (let i = 0; i < teeth * 2; i++) {
            const r = i % 2 === 0 ? outerR : innerR;
            const angle = (Math.PI * i) / teeth;
            points.push([cx + r * Math.sin(angle), cy - r * Math.cos(angle)]);
        }
        doc.polygon(...points).fill(NAVY);
        doc.circle(cx, cy, innerR - 6).lineWidth(1.5).strokeColor(GOLD).fillAndStroke('#FFFFFF', GOLD);

        if (logoBuffer) {
            try {
                doc.image(logoBuffer, cx - 22, cy - 22, { fit: [44, 44], align: 'center', valign: 'center' });
            } catch {
                this.drawSealMonogram(doc, cx, cy, organizationName);
            }
        } else {
            this.drawSealMonogram(doc, cx, cy, organizationName);
        }

        // Fita pendurada abaixo do selo, com recorte em V na ponta.
        const ribbonW = 26;
        const ribbonTop = cy + innerR - 8;
        const ribbonBottom = ribbonTop + 46;
        doc.polygon(
            [cx - ribbonW / 2, ribbonTop],
            [cx + ribbonW / 2, ribbonTop],
            [cx + ribbonW / 2, ribbonBottom],
            [cx, ribbonBottom - 14],
            [cx - ribbonW / 2, ribbonBottom],
        ).fill(NAVY_LIGHT);
    }

    private drawSealMonogram(doc: PDFKit.PDFDocument, cx: number, cy: number, organizationName: string) {
        const initials = organizationName
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map((word) => word[0]?.toUpperCase())
            .join('');
        doc.fontSize(18).font('Helvetica-Bold').fillColor(NAVY).text(initials, cx - 30, cy - 9, { width: 60, align: 'center' });
    }

    private drawHeader(doc: PDFKit.PDFDocument, organizationName: string) {
        doc.fontSize(32).font('Helvetica-Bold').fillColor(NAVY).text('CERTIFICADO', 170, 48, { width: 420 });
        doc.fontSize(11).font('Helvetica').fillColor(TEXT_MUTED).text(organizationName.toUpperCase(), 170, 92, { width: 420 });
    }

    private drawCourseBanner(doc: PDFKit.PDFDocument, width: number, courseName: string) {
        const barX = 70;
        const barY = 148;
        const barW = width - 140;
        const barH = 42;

        doc.rect(barX, barY, barW, 2.5).fill(GOLD);
        doc.rect(barX, barY + 2.5, barW, barH - 5).fill(NAVY);
        doc.rect(barX, barY + barH - 2.5, barW, 2.5).fill(GOLD);

        doc.fontSize(15).font('Helvetica-Bold').fillColor('#FFFFFF').text(courseName.toUpperCase(), barX + 20, barY + 12, {
            width: barW - 40,
            align: 'center',
        });
    }

    private drawBody(doc: PDFKit.PDFDocument, width: number, certificate: CertificateForPdf) {
        const studentName = certificate.enrollment.studentProfile.user.name;
        const location = certificate.enrollment.course.event.location;
        const issuedAt = certificate.issuedAt.toLocaleDateString('pt-BR');

        let y = 218;
        doc.fontSize(13).font('Helvetica').fillColor(TEXT_DARK).text('Certificamos que', 0, y, { align: 'center' });

        y += 24;
        doc.fontSize(22).font('Helvetica-Bold').fillColor(NAVY).text(studentName, 0, y, { align: 'center' });

        y += 34;
        doc.fontSize(13).font('Helvetica').fillColor(TEXT_DARK).text(
            `concluiu com aproveitamento a turma "${certificate.enrollment.course.event.title}"${location ? `, em ${location}` : ''}, em ${issuedAt}.`,
            80,
            y,
            { width: width - 160, align: 'center' },
        );

        if (certificate.expiresAt) {
            y += 28;
            doc.fontSize(11).fillColor(TEXT_MUTED).text(`Validade: até ${certificate.expiresAt.toLocaleDateString('pt-BR')}.`, 0, y, {
                align: 'center',
            });
        }
    }

    private drawSignatures(
        doc: PDFKit.PDFDocument,
        width: number,
        height: number,
        certificate: CertificateForPdf,
        template: CertificateTemplateForPdf | null,
        signatureImageBuffer: Buffer | null,
    ) {
        const lineY = height - 170;
        const studentX = 80;
        const studentW = 220;
        const instructorX = 360;
        const instructorW = 220;

        // Coluna do aluno: sempre linha em branco — o sistema não captura assinatura digital do aluno,
        // o certificado é impresso e assinado à mão.
        doc.moveTo(studentX, lineY).lineTo(studentX + studentW, lineY).strokeColor(LINE_MUTED).stroke();
        doc.fontSize(11).font('Helvetica-Bold').fillColor(TEXT_DARK).text(
            certificate.enrollment.studentProfile.user.name,
            studentX,
            lineY + 6,
            { width: studentW, align: 'center' },
        );
        doc.fontSize(9).font('Helvetica').fillColor(TEXT_MUTED).text('Aluno(a)', studentX, lineY + 22, {
            width: studentW,
            align: 'center',
        });

        // Coluna do instrutor/direção: usa a imagem de assinatura da personalização da academia, se houver.
        if (signatureImageBuffer) {
            try {
                doc.image(signatureImageBuffer, instructorX + instructorW / 2 - 60, lineY - 45, { fit: [120, 40], align: 'center' });
            } catch {
                // Imagem inválida — segue só com a linha, como se não houvesse assinatura.
            }
        }
        doc.moveTo(instructorX, lineY).lineTo(instructorX + instructorW, lineY).strokeColor(LINE_MUTED).stroke();
        doc.fontSize(11).font('Helvetica-Bold').fillColor(TEXT_DARK).text(
            template?.signatureName || 'Direção da Academia',
            instructorX,
            lineY + 6,
            { width: instructorW, align: 'center' },
        );
        doc.fontSize(9).font('Helvetica').fillColor(TEXT_MUTED).text('Instrutor(a) responsável', instructorX, lineY + 22, {
            width: instructorW,
            align: 'center',
        });
    }

    private drawQrCode(doc: PDFKit.PDFDocument, width: number, height: number, qrCodeBuffer: Buffer) {
        // Rótulo posicionado com folga generosa da margem inferior: um `text()` cujo bloco
        // ultrapassa `page.height - margins.bottom` faz o pdfkit abrir uma 2ª página sozinho
        // para o resto do texto, em vez de simplesmente cortar — já aconteceu aqui uma vez.
        doc.image(qrCodeBuffer, width - 150, height - 190, { width: 90 });
        doc.fontSize(8).fillColor(TEXT_MUTED).text('Valide este certificado', width - 160, height - 95, {
            width: 110,
            align: 'center',
        });
    }

    private drawSyllabusPage(
        doc: PDFKit.PDFDocument,
        width: number,
        height: number,
        courseTitle: string,
        syllabus: string,
        qrCodeBuffer: Buffer,
    ) {
        doc.fontSize(26).font('Helvetica-Bold').fillColor(GOLD).text('CONTEÚDO PROGRAMÁTICO', 0, 55, { align: 'center' });
        doc.fontSize(12).font('Helvetica').fillColor(TEXT_MUTED).text(courseTitle, 0, 90, { align: 'center' });

        // Sem `height` aqui de propósito: com um valor fixo o pdfkit corta o texto
        // que não coube (bug já visto uma vez) em vez de continuar em nova página.
        // Deixando fluir, o listener `pageAdded` em generate() redesenha a moldura
        // em qualquer página extra que isso gerar.
        doc.fontSize(11).font('Helvetica').fillColor(TEXT_DARK).text(syllabus, 90, 140, {
            width: width - 180,
            align: 'left',
            lineGap: 4,
        });

        this.drawQrCode(doc, width, height, qrCodeBuffer);
    }
}
