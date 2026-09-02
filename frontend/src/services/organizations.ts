import { api } from './api';
import type { Organization, Paginated } from '@/types';

export interface CreateOrganizationInput {
    name: string;
    subdomain?: string;
    isMatrix?: boolean;
    parentOrganizationId?: string;
    groupName?: string;
}

export type UpdateOrganizationInput = Partial<CreateOrganizationInput>;

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
};
