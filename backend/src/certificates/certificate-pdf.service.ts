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

@Injectable()
export class CertificatePdfService {
    private readonly logger = new Logger(CertificatePdfService.name);

    constructor(private readonly configService: ConfigService) {}

    async generate(
        certificate: CertificateForPdf,
        template: { logoUrl?: string | null; signatureName?: string | null } | null,
    ): Promise<Buffer> {
        const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:5173';
        const badgeUrl = `${frontendUrl}/badge/${certificate.enrollment.studentProfile.user.publicBadgeToken}`;
        const qrCodeBuffer = await QRCode.toBuffer(badgeUrl, { margin: 1, width: 200 });

        return new Promise<Buffer>((resolve, reject) => {
            const doc = new PDFDocument({ layout: 'landscape', size: 'A4', margin: 50 });
            const chunks: Buffer[] = [];
            doc.on('data', (chunk) => chunks.push(chunk));
            doc.on('end', () => resolve(Buffer.concat(chunks)));
            doc.on('error', reject);

            const { width, height } = doc.page;

            doc.rect(20, 20, width - 40, height - 40).lineWidth(2).strokeColor('#0056b3').stroke();

            doc.fontSize(12).fillColor('#6C757D').font('Helvetica').text(
                certificate.organization.name,
                0,
                60,
                { align: 'center' },
            );

            doc.fontSize(30).fillColor('#212529').font('Helvetica-Bold').text('CERTIFICADO', 0, 100, {
                align: 'center',
            });

            const studentName = certificate.enrollment.studentProfile.user.name;
            const courseName = certificate.enrollment.course.event.title;
            const issuedAt = certificate.issuedAt.toLocaleDateString('pt-BR');

            doc.moveDown(2);
            doc.fontSize(13).font('Helvetica').fillColor('#343A40').text(
                'Certificamos que',
                { align: 'center' },
            );

            doc.moveDown(0.5);
            doc.fontSize(22).font('Helvetica-Bold').fillColor('#0056b3').text(studentName, { align: 'center' });

            doc.moveDown(0.5);
            doc.fontSize(13).font('Helvetica').fillColor('#343A40').text(
                `concluiu com aproveitamento o curso "${courseName}", em ${issuedAt}.`,
                { align: 'center' },
            );

            if (certificate.expiresAt) {
                doc.moveDown(0.5);
                doc.fontSize(11).fillColor('#6C757D').text(
                    `Validade: até ${certificate.expiresAt.toLocaleDateString('pt-BR')}.`,
                    { align: 'center' },
                );
            }

            const signatureY = height - 140;
            doc.moveTo(width / 2 - 100, signatureY).lineTo(width / 2 + 100, signatureY).strokeColor('#adb5bd').stroke();
            doc.fontSize(11).fillColor('#343A40').text(
                template?.signatureName || 'Direção da Academia',
                width / 2 - 100,
                signatureY + 6,
                { width: 200, align: 'center' },
            );

            doc.image(qrCodeBuffer, width - 150, height - 150, { width: 90 });
            doc.fontSize(8).fillColor('#6C757D').text('Valide este certificado', width - 150, height - 55, {
                width: 90,
                align: 'center',
            });

            doc.end();
        }).catch((error) => {
            this.logger.error(`Falha ao gerar PDF do certificado ${certificate.id}: ${error.message}`, error.stack);
            throw error;
        });
    }
}
