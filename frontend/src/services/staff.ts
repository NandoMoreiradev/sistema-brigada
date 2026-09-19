import { api } from './api';

export interface ExternalCertification {
    id: string;
    name: string;
    issuingOrg: string | null;
    issuedAt: string | null;
    expiresAt: string | null;
    proofFileKey: string | null;
}

export interface StaffMember {
    id: string;
    status: 'ACTIVE' | 'INACTIVE';
    approvedAt: string;
    user: { id: string; name: string; email: string; phone?: string | null };
    externalCertifications: ExternalCertification[];
    _count: { designations: number };
}

export interface CreateExternalCertificationInput {
    name: string;
    issuingOrg?: string;
    issuedAt?: string;
    expiresAt?: string;
    proofFileKey?: string;
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
    addExternalCertification: async (staffId: string, input: CreateExternalCertificationInput) => {
        const { data } = await api.post<ExternalCertification>(`/staff/${staffId}/external-certifications`, input);
        return data;
    },
};
