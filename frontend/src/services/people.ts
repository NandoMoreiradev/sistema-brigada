// frontend/src/services/people.ts
// Cliente da API de `/users` (gestão de pessoas — alunos/instrutores/admins).

import { api } from './api';
import type { OrgPerson, Paginated, PioneerStatus } from '@/types';

export interface StudentProfileInput {
    birthDate?: string;
    gender?: string;
    guardianName?: string;
    guardianPhone?: string;
    baptismDate?: string;
    pioneerStatus?: PioneerStatus;
    signedPetitions?: string[];
    profession?: string;
}

export interface CreatePersonInput {
    name: string;
    email: string;
    phone?: string;
    role?: 'ORG_ADMIN' | 'ORG_USER';
    studentProfile?: StudentProfileInput;
}

export interface UpdatePersonInput {
    name?: string;
    phone?: string;
    isActive?: boolean;
    studentProfile?: StudentProfileInput;
}

/**
 * Decisão 32 (docs/decisoes.md): certificação/qualificação prévia é presa
 * direto na pessoa (`User`), não a um papel específico (staff/instrutor) —
 * por isso mora aqui, junto do resto do cadastro de pessoa, e não em
 * services/staff.ts.
 */
export interface ExternalCertification {
    id: string;
    name: string;
    issuingOrg: string | null;
    issuedAt: string | null;
    expiresAt: string | null;
    proofFileKey: string | null;
}

export interface CreateExternalCertificationInput {
    name: string;
    issuingOrg?: string;
    issuedAt?: string;
    expiresAt?: string;
    proofFileKey?: string;
}

export const peopleApi = {
    list: async (params?: { search?: string; hasStudentProfile?: boolean; limit?: number }) => {
        const { data } = await api.get<Paginated<OrgPerson>>('/users', { params: { limit: 100, ...params } });
        return data;
    },
    /** Versão enxuta (só id+nome) aberta a qualquer autenticado — ver GET /users/roster no backend. */
    roster: async () => {
        const { data } = await api.get<{ id: string; name: string }[]>('/users/roster');
        return data;
    },
    create: async (input: CreatePersonInput) => {
        const { data } = await api.post<OrgPerson>('/users', input);
        return data;
    },
    update: async (id: string, input: UpdatePersonInput) => {
        const { data } = await api.patch<OrgPerson>(`/users/${id}`, input);
        return data;
    },
    setRoleAssignment: async (id: string, roleAssignmentId: string | null) => {
        const { data } = await api.put<OrgPerson>(`/users/${id}/role-assignment`, { roleAssignmentId });
        return data;
    },
    setDirectPermissions: async (id: string, permissionIds: string[]) => {
        const { data } = await api.put<OrgPerson>(`/users/${id}/direct-permissions`, { permissionIds });
        return data;
    },
    sendPasswordReset: async (id: string) => {
        const { data } = await api.post<{ message: string }>(`/users/${id}/send-password-reset`);
        return data;
    },
    addExternalCertification: async (userId: string, input: CreateExternalCertificationInput) => {
        const { data } = await api.post<ExternalCertification>(`/users/${userId}/external-certifications`, input);
        return data;
    },
};
