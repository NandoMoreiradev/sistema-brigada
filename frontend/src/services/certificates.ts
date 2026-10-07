import { api } from './api';
import type { Paginated } from '@/types';

export type CertificateStatus = 'VALID' | 'EXPIRED' | 'REVOKED';

export interface Certificate {
    id: string;
    code: string;
    issuedAt: string;
    expiresAt: string | null;
    status: CertificateStatus;
    issuedAutomatically: boolean;
    pdfKey: string | null;
    pdfUrl: string | null;
    revokedAt: string | null;
    revokedReason: string | null;
    enrollment: {
        course: { event: { title: string } };
        studentProfile: { user: { id: string; name: string; email: string } };
    };
}

export interface CertificateTemplate {
    organizationId: string;
    logoUrl: string | null;
    signatureName: string | null;
    signatureImageUrl: string | null;
}

/** Resposta da validação pública (`/validar/:code`). */
export interface CertificateVerification {
    code: string;
    status: CertificateStatus;
    studentName: string;
    courseName: string;
    courseCategory: string | null;
    organizationName: string;
    issuedAt: string;
    expiresAt: string | null;
    revokedAt: string | null;
}

/** XXXX-XXXX-XXXX — mesma formatação impressa no PDF. Aceita o código cru ou já digitado com hífens/espaços. */
export const formatCertificateCode = (code: string) => {
    const clean = code.replace(/[\s-]/g, '').toUpperCase();
    return clean.match(/.{1,4}/g)?.join('-') ?? clean;
};

export const certificatesApi = {
    list: async (params?: { status?: CertificateStatus; expiringInDays?: number }) => {
        const { data } = await api.get<Paginated<Certificate>>('/certificates', { params: { ...params, limit: 100 } });
        return data;
    },
    regeneratePdf: async (id: string) => {
        const { data } = await api.post<Certificate>(`/certificates/${id}/regenerate-pdf`);
        return data;
    },
    issue: async (enrollmentId: string, force?: boolean) => {
        const { data } = await api.post<Certificate>('/certificates/issue', { enrollmentId, force });
        return data;
    },
    revoke: async (id: string, reason: string) => {
        const { data } = await api.post<Certificate>(`/certificates/${id}/revoke`, { reason });
        return data;
    },
    reinstate: async (id: string) => {
        const { data } = await api.post<Certificate>(`/certificates/${id}/reinstate`);
        return data;
    },
    verify: async (code: string) => {
        const { data } = await api.get<CertificateVerification>(`/public/certificates/${encodeURIComponent(code)}`);
        return data;
    },
};

export const certificateTemplateApi = {
    get: async () => {
        const { data } = await api.get<CertificateTemplate | null>('/certificate-templates');
        return data;
    },
    /** `null` apaga o campo; ausente mantém o valor salvo. */
    upsert: async (input: Partial<Pick<CertificateTemplate, 'logoUrl' | 'signatureName' | 'signatureImageUrl'>>) => {
        const { data } = await api.put<CertificateTemplate>('/certificate-templates', input);
        return data;
    },
};
