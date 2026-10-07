import { generateCertificateCode, normalizeCertificateCode, formatCertificateCode } from './certificate-code';
import { effectiveCertificateStatus } from './certificate-status';
import { CertificateStatus } from '@prisma/client';

describe('certificate-code', () => {
    it('gera 12 caracteres do alfabeto Crockford (sem I, L, O, U)', () => {
        for (let i = 0; i < 200; i++) {
            expect(generateCertificateCode()).toMatch(/^[0-9ABCDEFGHJKMNPQRSTVWXYZ]{12}$/);
        }
    });

    it('normaliza o que a pessoa digita para a forma guardada', () => {
        expect(normalizeCertificateCode('ab3k-9x2m-q7td')).toBe('AB3K9X2MQ7TD');
        expect(normalizeCertificateCode(' AB3K 9X2M Q7TD ')).toBe('AB3K9X2MQ7TD');
        // O lido como 0, I/L lidos como 1
        expect(normalizeCertificateCode('O1IL-0000-0000')).toBe('011100000000');
    });

    it('um código gerado sobrevive a formatar + normalizar', () => {
        const code = generateCertificateCode();
        expect(normalizeCertificateCode(formatCertificateCode(code))).toBe(code);
    });

    it('formata em blocos de 4', () => {
        expect(formatCertificateCode('AB3K9X2MQ7TD')).toBe('AB3K-9X2M-Q7TD');
    });
});

describe('effectiveCertificateStatus', () => {
    const yesterday = new Date(Date.now() - 86_400_000);
    const tomorrow = new Date(Date.now() + 86_400_000);

    it('VALID com validade passada é EXPIRED mesmo antes do job rodar', () => {
        expect(effectiveCertificateStatus({ status: CertificateStatus.VALID, expiresAt: yesterday })).toBe(CertificateStatus.EXPIRED);
    });

    it('mantém VALID dentro da validade ou sem vencimento', () => {
        expect(effectiveCertificateStatus({ status: CertificateStatus.VALID, expiresAt: tomorrow })).toBe(CertificateStatus.VALID);
        expect(effectiveCertificateStatus({ status: CertificateStatus.VALID, expiresAt: null })).toBe(CertificateStatus.VALID);
    });

    it('REVOKED continua REVOKED mesmo vencido', () => {
        expect(effectiveCertificateStatus({ status: CertificateStatus.REVOKED, expiresAt: yesterday })).toBe(CertificateStatus.REVOKED);
    });
});
