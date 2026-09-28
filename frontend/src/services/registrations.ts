import { api } from './api';
import type { Paginated, RegistrationRequest, PioneerStatus } from '@/types';

export interface PublicRegistrationForm {
    organizationName: string;
    organizationLogoUrl?: string | null;
    enabledFields: string[];
}

export interface SubmitRegistrationInput {
    name: string;
    email: string;
    phone: string;
    baptismDate?: string;
    pioneerStatus?: PioneerStatus;
    signedPetitions?: string[];
    profession?: string;
}

// Sem autenticação — usado pela página pública de autocadastro (/register/:token).
export const registrationsPublicApi = {
    getForm: async (token: string) => {
        const { data } = await api.get<PublicRegistrationForm>(`/public/registrations/${token}`);
        return data;
    },
    submit: async (token: string, input: SubmitRegistrationInput) => {
        const { data } = await api.post<{ message: string }>(`/public/registrations/${token}`, input);
        return data;
    },
};

export interface ApproveRegistrationInput {
    baptismDate?: string;
    pioneerStatus?: PioneerStatus;
    signedPetitions?: string[];
    profession?: string;
}

// registrations:manage — tela de revisão dos cadastros pendentes.
export const registrationsApi = {
    list: async (status?: 'PENDING' | 'APPROVED' | 'REJECTED') => {
        const { data } = await api.get<Paginated<RegistrationRequest>>('/registrations', { params: { status, limit: 100 } });
        return data;
    },
    findOne: async (id: string) => {
        const { data } = await api.get<RegistrationRequest>(`/registrations/${id}`);
        return data;
    },
    approve: async (id: string, input: ApproveRegistrationInput) => {
        const { data } = await api.patch<RegistrationRequest>(`/registrations/${id}/approve`, input);
        return data;
    },
    reject: async (id: string, reason?: string) => {
        const { data } = await api.patch<RegistrationRequest>(`/registrations/${id}/reject`, { reason });
        return data;
    },
};
