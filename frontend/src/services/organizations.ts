import { api } from './api';
import type { Organization, Paginated } from '@/types';

export interface CreateOrganizationInput {
    name: string;
    /** Definido no mesmo formulário de criação — vira o primeiro ORG_ADMIN da academia. */
    adminName: string;
    adminEmail: string;
    subdomain?: string;
    isMatrix?: boolean;
    parentOrganizationId?: string;
    groupName?: string;
}

// Não é `Partial<CreateOrganizationInput>`: adminName/adminEmail só existem na criação
// (definir o administrador é um passo único). Em compensação, a edição ganha os campos de
// configuração de e-mail da academia (chave Resend própria + remetente).
export interface UpdateOrganizationInput {
    name?: string;
    subdomain?: string;
    isMatrix?: boolean;
    parentOrganizationId?: string;
    groupName?: string;
    resendApiKey?: string;
    emailFromAddress?: string;
    emailFromName?: string;
}

export const organizationsApi = {
    list: async (search?: string) => {
        const { data } = await api.get<Paginated<Organization & { _count: { users: number; courses: number } }>>(
            '/organizations',
            { params: { search, limit: 100 } },
        );
        return data;
    },
    create: async (input: CreateOrganizationInput) => {
        const { data } = await api.post<Organization>('/organizations', input);
        return data;
    },
    update: async (id: string, input: UpdateOrganizationInput) => {
        const { data } = await api.patch<Organization>(`/organizations/${id}`, input);
        return data;
    },
    remove: async (id: string) => {
        await api.delete(`/organizations/${id}`);
    },
    impersonate: async (id: string) => {
        const { data } = await api.post<{
            access_token: string;
            impersonatedUser: { id: string; name: string; email: string };
        }>(`/organizations/${id}/impersonate`);
        return data;
    },
};
