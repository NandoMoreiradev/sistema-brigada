// frontend/src/services/integrations.ts
// Cliente da API de integrações pessoais (backend/src/user-integrations) —
// hoje só Google Calendar, usado pra gerar o link do Google Meet automático
// nas reuniões (ver events.service.ts no backend).

import { api } from './api';

export const integrationsApi = {
    getGoogleAuthUrl: async () => {
        const { data } = await api.get<{ url: string }>('/user-integrations/google/auth');
        return data;
    },
    getGoogleStatus: async () => {
        const { data } = await api.get<{ connected: boolean }>('/user-integrations/google/status');
        return data;
    },
    disconnectGoogle: async () => {
        await api.delete('/user-integrations/google');
    },
};
