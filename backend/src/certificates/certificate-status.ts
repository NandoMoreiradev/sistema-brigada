import { CertificateStatus } from '@prisma/client';

/**
 * O job diário marca EXPIRED, mas entre o vencimento e a próxima rodada o registro ainda
 * diz VALID — toda leitura que mostra o status passa por aqui para nunca exibir "Válido"
 * num certificado que já venceu.
 */
export function effectiveCertificateStatus(certificate: { status: CertificateStatus; expiresAt: Date | null }): CertificateStatus {
    if (certificate.status === CertificateStatus.VALID && certificate.expiresAt && certificate.expiresAt < new Date()) {
        return CertificateStatus.EXPIRED;
    }
    return certificate.status;
}
