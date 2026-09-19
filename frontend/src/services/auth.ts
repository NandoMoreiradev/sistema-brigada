// frontend/src/services/auth.ts
// Cliente da API de perfil/senha/2FA (backend/src/auth). Endpoints já
// existiam no backend antes desta tela — só não tinham nenhum consumidor no
// frontend (ver aba "Perfil" da central de configurações).

import { api } from './api';

export interface UpdateProfileInput {
    name: string;
    phone?: string;
}

export const authApi = {
    forgotPassword: async (email: string) => {
        const { data } = await api.post<{ message: string }>('/auth/forgot-password', { email });
        return data;
    },
    resetPassword: async (token: string, newPassword: string) => {
        const { data } = await api.post<{ message: string }>('/auth/reset-password', { token, newPassword });
        return data;
    },
    updateProfile: async (input: UpdateProfileInput) => {
        const { data } = await api.patch<{ access_token: string }>('/auth/profile', input);
        return data;
    },
    changePassword: async (currentPassword: string, newPassword: string) => {
        const { data } = await api.patch<{ message: string }>('/auth/change-password', { currentPassword, newPassword });
        return data;
    },
    generateTwoFactor: async () => {
        const { data } = await api.post<{ qrCodeDataURL: string }>('/auth/2fa/generate');
        return data;
    },
    turnOnTwoFactor: async (code: string) => {
        const { data } = await api.post<{ message: string; recoveryCodes: string[] }>('/auth/2fa/turn-on', { code });
        return data;
    },
    turnOffTwoFactor: async (code: string) => {
        const { data } = await api.post<{ message: string }>('/auth/2fa/turn-off', { code });
        return data;
    },
};
