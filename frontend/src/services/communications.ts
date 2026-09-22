// frontend/src/services/communications.ts
//
// Cliente típado para /communications (backend/src/communications) — comunicados (e-mail
// avulso) escopados sempre à academia ativa (header x-active-organization-id, já anexado por
// src/services/api.ts). Diferente de services/emailTemplates.ts (templates dos 3 gatilhos
// automáticos): aqui não existe "padrão global".

import { api } from './api';

export type CommunicationAudience = 'ALL' | 'STUDENTS' | 'STAFF' | 'CUSTOM';
export type CommunicationStatus = 'DRAFT' | 'SENDING' | 'SENT' | 'FAILED';
export type CommunicationRecipientStatus = 'PENDING' | 'SENT' | 'FAILED';

export interface CommunicationRecipient {
    id: string;
    userId: string;
    name: string;
    email: string;
    status: CommunicationRecipientStatus;
    errorMessage: string | null;
    sentAt: string | null;
    openedAt: string | null;
    openCount: number;
}

export interface Communication {
    id: string;
    organizationId: string;
    subject: string;
    body: string;
    designJson: Record<string, unknown> | null;
    audience: CommunicationAudience;
    customRecipientUserIds: string[];
    status: CommunicationStatus;
    recipientCount: number;
    failedCount: number;
    openedCount: number;
    createdByUserId: string;
    createdAt: string;
    updatedAt: string;
    sentAt: string | null;
    createdBy?: { id: string; name: string } | null;
    recipients?: CommunicationRecipient[];
}

export interface CommunicationListResponse {
    data: Communication[];
    total: number;
    page: number;
    totalPages: number;
}

export interface UpdateCommunicationInput {
    subject?: string;
    body?: string;
    designJson?: Record<string, unknown>;
    audience?: CommunicationAudience;
    customRecipientUserIds?: string[];
}

export interface ListCommunicationsQuery {
    page?: number;
    limit?: number;
    search?: string;
}

export const communicationsApi = {
    list: async (query: ListCommunicationsQuery = {}) => {
        const { data } = await api.get<CommunicationListResponse>('/communications', { params: query });
        return data;
    },
    get: async (id: string) => {
        const { data } = await api.get<Communication>(`/communications/${id}`);
        return data;
    },
    create: async () => {
        const { data } = await api.post<Communication>('/communications', {});
        return data;
    },
    update: async (id: string, input: UpdateCommunicationInput) => {
        const { data } = await api.patch<Communication>(`/communications/${id}`, input);
        return data;
    },
    remove: async (id: string) => {
        await api.delete(`/communications/${id}`);
    },
    send: async (id: string) => {
        const { data } = await api.post<{ message: string; recipientCount: number }>(`/communications/${id}/send`);
        return data;
    },
    sendTest: async (id: string, to: string) => {
        const { data } = await api.post<{ message: string }>(`/communications/${id}/send-test`, { to });
        return data;
    },
};
