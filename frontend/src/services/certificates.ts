import { api } from './api';
import type { Paginated } from '@/types';
import type { CertificateLayout, CertificateVariable } from '@/pages/certificates/layout/types';

export interface LayoutPreset {
    id: string;
    name: string;
    description: string;
    layout: CertificateLayout;
}

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
    organizationName: string;
    logoUrl: string | null;
    signatureName: string | null;
    signatureImageUrl: string | null;
    /** Modelo padrão da academia; null = nenhum salvo, vale o Clássico embutido */
    defaultDesignId: string | null;
}

export interface CertificateTemplateInput {
    logoUrl?: string | null;
    signatureName?: string | null;
    signatureImageUrl?: string | null;
}

/** Modelo de certificado da academia (vários; um é o padrão; a turma pode escolher outro). */
export interface CertificateDesign {
    id: string;
    name: string;
    isDefault: boolean;
    layout: CertificateLayout;
    /** Turmas que escolheram este modelo explicitamente */
    coursesCount: number;
    createdAt: string;
    updatedAt: string;
}

export interface BulkRegenerationStatus {
    total: number;
    done: number;
    failed: number;
    startedAt: string;
    finishedAt: string | null;
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
    regenerateAll: async (scope: { courseId?: string; designId?: string }) => {
        const { data } = await api.post<BulkRegenerationStatus>('/certificates/regenerate-pdfs', scope);
        return data;
    },
    regenerationStatus: async () => {
        const { data } = await api.get<BulkRegenerationStatus | null>('/certificates/regenerate-pdfs/status');
        return data || null;
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
    preview: async (input: CertificateTemplateInput & { layout?: CertificateLayout; designId?: string; courseId?: string }) => {
        const { data } = await api.post<Blob>('/certificate-templates/preview', input, { responseType: 'blob' });
        return data;
    },
    variables: async () => {
        const { data } = await api.get<CertificateVariable[]>('/certificate-templates/variables');
        return data;
    },
    presets: async () => {
        const { data } = await api.get<LayoutPreset[]>('/certificate-templates/presets');
        return data;
    },
};

export const certificateDesignsApi = {
    list: async () => {
        const { data } = await api.get<CertificateDesign[]>('/certificate-designs');
        return data;
    },
    get: async (id: string) => {
        const { data } = await api.get<CertificateDesign>(`/certificate-designs/${id}`);
        return data;
    },
    create: async (input: { name: string; presetId?: string; duplicateFromId?: string; layout?: CertificateLayout }) => {
        const { data } = await api.post<CertificateDesign>('/certificate-designs', input);
        return data;
    },
    update: async (id: string, input: { name?: string; layout?: CertificateLayout }) => {
        const { data } = await api.put<CertificateDesign>(`/certificate-designs/${id}`, input);
        return data;
    },
    setDefault: async (id: string) => {
        const { data } = await api.post<CertificateDesign[]>(`/certificate-designs/${id}/default`);
        return data;
    },
    remove: async (id: string) => {
        await api.delete(`/certificate-designs/${id}`);
    },
};
