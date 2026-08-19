// frontend/src/services/api.ts
//
// Cliente axios com refresh de token automático, adaptado do maskotCrmEdu.
// Diferenças do original:
//   - `x-active-school-id` -> `x-active-organization-id` / `schoolId` -> `organizationId`
//   - Sem lógica de PLAN_LIMIT_REACHED / TRIAL_EXPIRED (sem módulo financeiro no MVP)
//   - Sem "visão consolidada" multi-escola (não existe ainda neste produto)

import axios from 'axios';
import { toast } from '@/utils/toast';
import { tokenManager } from './tokenManager';
import { isPublicAccess } from '@/utils/publicRouting';

function isPublicRoute(): boolean {
    return isPublicAccess(window.location);
}

const getBaseURL = () => {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
    if (apiUrl.endsWith('/api/v1')) return apiUrl;
    return `${apiUrl}/api/v1`;
};

const baseURL = getBaseURL();

export const api = axios.create({
    baseURL,
    withCredentials: true, // envia cookies httpOnly automaticamente
});

// --- REQUEST INTERCEPTOR ---
api.interceptors.request.use(
    (config) => {
        // Lê o access_token da memória (nunca do localStorage)
        const token = tokenManager.get();

        if (token) {
            config.headers['Authorization'] = `Bearer ${token}`;
        }

        // Respeita um override explícito de organização ativa por chamada. Só
        // recorre ao localStorage quando o header não foi definido pelo chamador.
        if (!config.headers['x-active-organization-id']) {
            const activeOrganizationId = localStorage.getItem('@BrigadaApp:activeOrganizationId');
            if (activeOrganizationId) {
                config.headers['x-active-organization-id'] = activeOrganizationId;
            }
        }

        if (config.method === 'get') {
            config.headers['cache-control'] = 'no-cache, no-store, must-revalidate';
            config.headers['pragma'] = 'no-cache';
            config.headers['expires'] = '0';
        }

        return config;
    },
    (error) => Promise.reject(error),
);

// --- Fila de requisições que aguardam o refresh silencioso ---
let isRefreshing = false;
let failedQueue: Array<{ resolve: (token: string) => void; reject: (err: any) => void }> = [];

function processQueue(error: any, token: string | null) {
    failedQueue.forEach(({ resolve, reject }) => {
        if (error) reject(error);
        else resolve(token!);
    });
    failedQueue = [];
}

// --- BroadcastChannel: sincroniza o access_token entre abas ---
const _tokenChannel = typeof BroadcastChannel !== 'undefined'
    ? new BroadcastChannel('brigada-token-refresh')
    : null;

if (_tokenChannel) {
    _tokenChannel.onmessage = (event) => {
        if (event.data?.type === 'TOKEN_REFRESHED' && event.data.access_token) {
            tokenManager.set(event.data.access_token);
        } else if (event.data?.type === 'SIGNED_OUT') {
            tokenManager.clear();
        }
    };
}

// --- RESPONSE INTERCEPTOR ---
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const status = error.response?.status;
        const errorData = error.response?.data;
        const originalRequest = error.config;

        const isRetriable401 = status === 401
            && !originalRequest?._retry
            && !isPublicRoute()
            && !originalRequest?.url?.includes('/auth/refresh')
            && !originalRequest?.url?.includes('/auth/logout');

        if (!isRetriable401) {
            console.error('API RESPONSE ERROR:', {
                url: error.config?.url,
                status,
                message: errorData?.message,
            });
        }

        // Erro de permissão/acesso — apenas avisa, não desloga.
        if (status === 403) {
            toast.error(errorData?.message || 'Você não tem permissão para acessar este recurso.');
            return Promise.reject(error);
        }

        // Token expirado (401) — tenta refresh silencioso antes de deslogar
        if (status === 401 && !originalRequest._retry && !isPublicRoute()) {
            if (originalRequest.url?.includes('/auth/refresh') || originalRequest.url?.includes('/auth/logout')) {
                const hadSession = localStorage.getItem('@BrigadaApp:user') !== null;
                tokenManager.clear();
                localStorage.removeItem('@BrigadaApp:user');
                if (hadSession) {
                    toast.error('Sua sessão expirou. Por favor, faça login novamente.');
                }
                window.location.href = '/login';
                return Promise.reject(error);
            }

            if (isRefreshing) {
                return new Promise((resolve, reject) => {
                    failedQueue.push({ resolve, reject });
                }).then((token) => {
                    originalRequest.headers['Authorization'] = `Bearer ${token}`;
                    return api(originalRequest);
                });
            }

            originalRequest._retry = true;
            isRefreshing = true;

            const doRefresh = async () => {
                const { data } = await axios.post(
                    `${baseURL}/auth/refresh`,
                    {},
                    { withCredentials: true },
                );
                tokenManager.set(data.access_token);
                _tokenChannel?.postMessage({ type: 'TOKEN_REFRESHED', access_token: data.access_token });
                return data.access_token as string;
            };

            const attemptRefresh = async (): Promise<string> => {
                if (typeof navigator !== 'undefined' && navigator.locks) {
                    return navigator.locks.request('brigada-token-refresh', doRefresh);
                }
                return doRefresh();
            };

            try {
                let newToken: string;

                try {
                    newToken = await attemptRefresh();
                } catch (firstError: any) {
                    const httpStatus = firstError?.response?.status;
                    if (httpStatus === 401 || httpStatus === 403) {
                        throw firstError;
                    }
                    console.warn('[api] Refresh falhou (erro transitório), tentando novamente em 2s...', firstError?.message);
                    await new Promise(r => setTimeout(r, 2000));
                    newToken = await attemptRefresh();
                }

                processQueue(null, newToken);
                originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
                return api(originalRequest);
            } catch (refreshError) {
                processQueue(refreshError, null);
                tokenManager.clear();
                localStorage.removeItem('@BrigadaApp:user');
                localStorage.removeItem('@BrigadaApp:activeOrganizationId');
                toast.error('Sua sessão expirou. Por favor, faça login novamente.');
                window.location.href = '/login';
                return Promise.reject(refreshError);
            } finally {
                isRefreshing = false;
            }
        }

        return Promise.reject(error);
    },
);
