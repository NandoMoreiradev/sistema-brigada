import { api } from './api';
import type { Paginated, RegistrationRequest, RegistrationInvite, RegistrationKind, PioneerStatus } from '@/types';

export interface PublicRegistrationForm {
    organizationName: string;
    organizationLogoUrl?: string | null;
    enabledFields: string[];
}

export interface PublicInviteForm extends PublicRegistrationForm {
    kind: RegistrationKind;
    email: string;
    name?: string | null;
}

export interface SubmitRegistrationInput {
    name: string;
    email: string;
    phone: string;
    /** Sugestão do link (?tipo=): quem revisa decide o papel final. */
    requestedKind?: RegistrationKind;
    birthDate?: string;
    baptismDate?: string;
    pioneerStatus?: PioneerStatus;
    signedPetitions?: string[];
    profession?: string;
}

// Sem autenticação — usado pela página pública de autocadastro (/register/:token).
export const registrationsPublicApi = {
    getForm: async (token: string, kind?: RegistrationKind) => {
        const { data } = await api.get<PublicRegistrationForm>(`/public/registrations/${token}`, { params: { kind } });
        return data;
    },
    submit: async (token: string, input: SubmitRegistrationInput) => {
        const { data } = await api.post<{ message: string }>(`/public/registrations/${token}`, input);
        return data;
    },
    getInviteForm: async (token: string) => {
        const { data } = await api.get<PublicInviteForm>(`/public/registrations/invite/${token}`);
        return data;
    },
    submitInvite: async (token: string, input: Omit<SubmitRegistrationInput, 'email' | 'requestedKind'>) => {
        const { data } = await api.post<{ message: string; emailSent: boolean }>(`/public/registrations/invite/${token}`, input);
        return data;
    },
};

export interface ApproveRegistrationInput {
    kind?: RegistrationKind;
    birthDate?: string;
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
    reject: async (id: string, input: { reason?: string; notify?: boolean }) => {
        const { data } = await api.patch<RegistrationRequest>(`/registrations/${id}/reject`, input);
        return data;
    },
    /** Só conta os pendentes (badge do menu): pede 1 item e lê o total. */
    pendingCount: async () => {
        const { data } = await api.get<Paginated<RegistrationRequest>>('/registrations', { params: { status: 'PENDING', limit: 1 } });
        return data.total;
    },
    resendAccess: async (id: string) => {
        const { data } = await api.post<{ sent: boolean; message: string }>(`/registrations/${id}/resend-access`);
        return data;
    },
    listInvites: async () => {
        const { data } = await api.get<RegistrationInvite[]>('/registrations/invites');
        return data;
    },
    createInvite: async (input: { email: string; name?: string; kind: RegistrationKind }) => {
        const { data } = await api.post<{ sent: boolean; invite: RegistrationInvite }>('/registrations/invites', input);
        return data;
    },
    resendInvite: async (id: string) => {
        const { data } = await api.post<{ sent: boolean; invite: RegistrationInvite }>(`/registrations/invites/${id}/resend`);
        return data;
    },
    revokeInvite: async (id: string) => {
        const { data } = await api.delete<RegistrationInvite>(`/registrations/invites/${id}`);
        return data;
    },
};
