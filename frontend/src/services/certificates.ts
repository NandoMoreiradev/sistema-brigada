import { api } from './api';
import type { Paginated } from '@/types';
import type { CertificateLayout, CertificateVariable } from '@/pages/certificates/layout/types';

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
    /** Layout efetivo: o salvo, ou o "Clássico" quando a academia nunca salvou um */
    layout: CertificateLayout;
    isDefaultLayout: boolean;
}

export interface CertificateTemplateInput {
    logoUrl?: string | null;
    signatureName?: string | null;
    signatureImageUrl?: string | null;
    /** `null` volta para o layout Clássico */
    layoutConfig?: CertificateLayout | null;
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

export type DigestFrequency = 'OFF' | 'DAILY' | 'WEEKLY';

export interface ReminderSettingsInput {
    enabled: boolean;
    /** Dias antes do vencimento (0 = no dia) */
    daysBefore: number[];
    daysAfter: number[];
    /** 0–23, horário de Brasília */
    sendHour: number;
    includeRecyclingSuggestion: boolean;
    digestFrequency: DigestFrequency;
    digestRecipientUserIds: string[];
    digestWindowDays: number;
}

export interface ReminderSettings extends ReminderSettingsInput {
    organizationId: string;
    /** true = a academia nunca salvou; valores padrão */
    isDefault: boolean;
}

export interface ReminderPreview {
    horizonDays: number;
    total: number;
    skippedAlreadyRenewed: number;
    items: Array<{
        date: string;
        certificateId: string;
        studentName: string;
        courseName: string;
        expiresAt: string;
        stage: string;
        stageLabel: string;
    }>;
}

export type ReminderStatus = 'SENDING' | 'SENT' | 'FAILED' | 'SKIPPED';

export interface CertificateReminderEntry {
    id: string;
    stage: string;
    stageLabel: string;
    status: ReminderStatus;
    attempts: number;
    error: string | null;
    sentAt: string | null;
    triggeredByUserId: string | null;
    createdAt: string;
}

export const certificateRemindersApi = {
    getSettings: async () => {
        const { data } = await api.get<ReminderSettings>('/certificate-reminders/settings');
        return data;
    },
    saveSettings: async (input: ReminderSettingsInput) => {
        const { data } = await api.put<ReminderSettings>('/certificate-reminders/settings', input);
        return data;
    },
    preview: async (input: ReminderSettingsInput) => {
        const { data } = await api.post<ReminderPreview>('/certificate-reminders/preview', input);
        return data;
    },
    listForCertificate: async (certificateId: string) => {
        const { data } = await api.get<CertificateReminderEntry[]>(`/certificate-reminders/certificates/${certificateId}`);
        return data;
    },
    sendNow: async (certificateId: string) => {
        const { data } = await api.post<CertificateReminderEntry>(`/certificate-reminders/certificates/${certificateId}/send`);
        return data;
    },
};

export const certificateTemplateApi = {
    get: async () => {
        const { data } = await api.get<CertificateTemplate | null>('/certificate-templates');
        return data;
    },
    /** `null` apaga o campo; ausente mantém o valor salvo. */
    upsert: async (input: CertificateTemplateInput) => {
        const { data } = await api.put<CertificateTemplate>('/certificate-templates', input);
        return data;
    },
    /** PDF de exemplo (Blob) com valores ainda não salvos; o que não for enviado usa o salvo. */
    preview: async (input: Omit<CertificateTemplateInput, 'layoutConfig'> & { layout?: CertificateLayout; courseId?: string }) => {
        const { data } = await api.post<Blob>('/certificate-templates/preview', input, { responseType: 'blob' });
        return data;
    },
    variables: async () => {
        const { data } = await api.get<CertificateVariable[]>('/certificate-templates/variables');
        return data;
    },
};
