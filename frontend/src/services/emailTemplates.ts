// frontend/src/services/emailTemplates.ts
//
// Cliente típado para /email-templates (backend/src/email-templates). SUPER_ADMIN sem
// organização ativa selecionada vê/edita os padrões globais; ORG_ADMIN (ou SUPER_ADMIN com
// uma academia ativa) vê/edita só o override da própria academia — o backend decide isso a
// partir do header x-active-organization-id, já anexado por src/services/api.ts.

import { api } from './api';

export type EmailTriggerType = 'ORGANIZATION_ADMIN_WELCOME' | 'PASSWORD_RESET' | 'CERTIFICATE_EXPIRING' | 'USER_WELCOME';

export interface EmailTemplate {
    id: string;
    name: string;
    subject: string;
    body: string;
    designJson: Record<string, unknown> | null;
    trigger: EmailTriggerType | null;
    organizationId: string | null;
    createdById: string | null;
    createdAt: string;
    updatedAt: string;
    organization?: { id: string; name: string } | null;
    createdBy?: { id: string; name: string } | null;
}

export interface EmailTemplateListResponse {
    data: EmailTemplate[];
    total: number;
    page: number;
    totalPages: number;
}

export interface CreateEmailTemplateInput {
    name: string;
    subject: string;
    body?: string;
    designJson?: Record<string, unknown>;
    trigger?: EmailTriggerType | null;
    /** Só SUPER_ADMIN pode definir — ausente/null = template padrão global. */
    organizationId?: string;
}

export type UpdateEmailTemplateInput = Partial<CreateEmailTemplateInput>;

export interface EmailTriggerOption {
    value: EmailTriggerType;
    label: string;
}

export interface MergeTag {
    value: string;
    label: string;
    description: string;
}

export interface MergeTagGroup {
    label: string;
    tags: MergeTag[];
}

export interface FindEmailTemplatesQuery {
    page?: number;
    limit?: number;
    search?: string;
    trigger?: string;
    scope?: 'global' | 'organization';
}

export const emailTemplatesApi = {
    list: async (query: FindEmailTemplatesQuery = {}) => {
        const { data } = await api.get<EmailTemplateListResponse>('/email-templates', { params: query });
        return data;
    },
    get: async (id: string) => {
        const { data } = await api.get<EmailTemplate>(`/email-templates/${id}`);
        return data;
    },
    create: async (input: CreateEmailTemplateInput) => {
        const { data } = await api.post<EmailTemplate>('/email-templates', input);
        return data;
    },
    update: async (id: string, input: UpdateEmailTemplateInput) => {
        const { data } = await api.patch<EmailTemplate>(`/email-templates/${id}`, input);
        return data;
    },
    remove: async (id: string) => {
        await api.delete(`/email-templates/${id}`);
    },
    sendTest: async (id: string, to: string) => {
        const { data } = await api.post<{ message: string }>(`/email-templates/${id}/send-test`, { to });
        return data;
    },
    getTriggers: async () => {
        const { data } = await api.get<EmailTriggerOption[]>('/email-templates/triggers');
        return data;
    },
    getMergeTags: async () => {
        const { data } = await api.get<MergeTagGroup[]>('/email-templates/merge-tags');
        return data;
    },
};
