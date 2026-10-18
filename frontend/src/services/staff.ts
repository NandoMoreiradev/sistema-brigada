import { api } from './api';
import type { ExternalCertification } from './people';

export interface StaffCategory {
    id: string;
    name: string;
    /** Quantas pessoas da equipe estão nesta categoria (só na listagem do catálogo). */
    _count?: { members: number };
}

export interface StaffMember {
    id: string;
    status: 'ACTIVE' | 'INACTIVE';
    approvedAt: string;
    category: Pick<StaffCategory, 'id' | 'name'> | null;
    user: { id: string; name: string; email: string; phone?: string | null; externalCertifications: ExternalCertification[] };
    _count: { designations: number };
}

export interface BulkPromoteResult {
    promoted: number;
    skipped: number;
}

export const staffApi = {
    list: async () => {
        const { data } = await api.get<StaffMember[]>('/staff');
        return data;
    },
    promote: async (userId: string, categoryId?: string) => {
        const { data } = await api.post<StaffMember>('/staff', { userId, categoryId });
        return data;
    },
    promoteMany: async (userIds: string[], categoryId?: string) => {
        const { data } = await api.post<BulkPromoteResult>('/staff/bulk', { userIds, categoryId });
        return data;
    },
    updateStatus: async (id: string, status: 'ACTIVE' | 'INACTIVE') => {
        const { data } = await api.patch<StaffMember>(`/staff/${id}/status`, { status });
        return data;
    },
    /** `null` tira a pessoa de qualquer categoria. */
    setCategory: async (id: string, categoryId: string | null) => {
        const { data } = await api.patch<StaffMember>(`/staff/${id}/category`, { categoryId });
        return data;
    },
    categories: {
        list: async () => {
            const { data } = await api.get<StaffCategory[]>('/staff/categories');
            return data;
        },
        create: async (name: string) => {
            const { data } = await api.post<StaffCategory>('/staff/categories', { name });
            return data;
        },
        rename: async (id: string, name: string) => {
            const { data } = await api.patch<StaffCategory>(`/staff/categories/${id}`, { name });
            return data;
        },
        remove: async (id: string) => {
            const { data } = await api.delete<{ id: string }>(`/staff/categories/${id}`);
            return data;
        },
    },
};
