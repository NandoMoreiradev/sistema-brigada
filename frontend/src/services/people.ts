// frontend/src/services/people.ts
// Cliente da API de `/users` (gestão de pessoas — alunos/instrutores/admins).

import { api } from './api';
import type { OrgPerson, Paginated } from '@/types';

export interface StudentProfileInput {
    birthDate?: string;
    gender?: string;
    guardianName?: string;
    guardianPhone?: string;
}

export interface CreatePersonInput {
    name: string;
    email: string;
    password: string;
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

export const peopleApi = {
    list: async (params?: { search?: string; hasStudentProfile?: boolean }) => {
        const { data } = await api.get<Paginated<OrgPerson>>('/users', { params: { ...params, limit: 100 } });
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
};
