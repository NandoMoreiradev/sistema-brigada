import { api } from './api';
import type { Paginated } from '@/types';

export type CertificateStatus = 'VALID' | 'EXPIRED' | 'REVOKED';

export interface Certificate {
    id: string;
    issuedAt: string;
    expiresAt: string | null;
    status: CertificateStatus;
    issuedAutomatically: boolean;
    pdfKey: string | null;
    pdfUrl: string | null;
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

export const certificatesApi = {
    list: async (params?: { status?: CertificateStatus; expiringInDays?: number }) => {
        const { data } = await api.get<Paginated<Certificate>>('/certificates', { params: { ...params, limit: 100 } });
        return data;
    },
    regeneratePdf: async (id: string) => {
        const { data } = await api.post<Certificate>(`/certificates/${id}/regenerate-pdf`);
        return data;
    },
    issue: async (enrollmentId: string) => {
        const { data } = await api.post<Certificate>('/certificates/issue', { enrollmentId });
        return data;
    },
};

export const certificateTemplateApi = {
    get: async () => {
        const { data } = await api.get<CertificateTemplate | null>('/certificate-templates');
        return data;
    },
    upsert: async (input: Partial<Pick<CertificateTemplate, 'logoUrl' | 'signatureName' | 'signatureImageUrl'>>) => {
        const { data } = await api.put<CertificateTemplate>('/certificate-templates', input);
        return data;
    },
};
