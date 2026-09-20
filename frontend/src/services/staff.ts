import { api } from './api';
import type { ExternalCertification } from './people';

export interface StaffMember {
    id: string;
    status: 'ACTIVE' | 'INACTIVE';
    approvedAt: string;
    user: { id: string; name: string; email: string; phone?: string | null; externalCertifications: ExternalCertification[] };
    _count: { designations: number };
}

export const staffApi = {
    list: async () => {
        const { data } = await api.get<StaffMember[]>('/staff');
        return data;
    },
    promote: async (userId: string) => {
        const { data } = await api.post<StaffMember>('/staff', { userId });
        return data;
    },
    updateStatus: async (id: string, status: 'ACTIVE' | 'INACTIVE') => {
        const { data } = await api.patch<StaffMember>(`/staff/${id}/status`, { status });
        return data;
    },
};
