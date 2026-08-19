// mobile/src/services/api.ts
//
// Cliente HTTP do app mobile, espelhando o padrão do frontend web
// (frontend/src/services/api.ts): interceptor de Authorization + refresh
// silencioso em 401. Duas diferenças por ser React Native:
//
//   1. Não há cookie jar de browser persistente: o access_token E o
//      refresh_token ficam no expo-secure-store (Keychain/Keystore), não em
//      memória nem em cookie httpOnly. O endpoint /auth/refresh aqui assume
//      que o backend aceita `refresh_token` no corpo para clientes mobile
//      (o fluxo web usa cookie httpOnly) — a confirmar quando o backend
//      expuser esse contrato.
//   2. `X-Active-Organization-Id` (equivalente ao ativo no web) também é
//      persistido no SecureStore, não no localStorage.

import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

const ACCESS_TOKEN_KEY = 'brigada.accessToken';
const REFRESH_TOKEN_KEY = 'brigada.refreshToken';
const ACTIVE_ORG_KEY = 'brigada.activeOrganizationId';

const getBaseURL = () => {
    const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
    if (apiUrl.endsWith('/api/v1')) return apiUrl;
    return `${apiUrl}/api/v1`;
};

export const api = axios.create({
    baseURL: getBaseURL(),
});

// Cache em memória para não bater no SecureStore (que é async) a cada request.
let _accessToken: string | null = null;
let _refreshToken: string | null = null;

export const authStorage = {
    async load() {
        _accessToken = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
        _refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
        return { accessToken: _accessToken, refreshToken: _refreshToken };
    },

    async setTokens(accessToken: string, refreshToken?: string | null) {
        _accessToken = accessToken;
        await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken);

        if (refreshToken) {
            _refreshToken = refreshToken;
            await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
        }
    },

    async setActiveOrganizationId(organizationId: string) {
        await SecureStore.setItemAsync(ACTIVE_ORG_KEY, organizationId);
    },

    async getActiveOrganizationId() {
        return SecureStore.getItemAsync(ACTIVE_ORG_KEY);
    },

    getAccessToken() {
        return _accessToken;
    },

    async clear() {
        _accessToken = null;
        _refreshToken = null;
        await Promise.all([
            SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
            SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
            SecureStore.deleteItemAsync(ACTIVE_ORG_KEY),
        ]);
    },
};

// --- REQUEST INTERCEPTOR ---
api.interceptors.request.use(async (config) => {
    if (_accessToken) {
        config.headers['Authorization'] = `Bearer ${_accessToken}`;
    }

    if (!config.headers['x-active-organization-id']) {
        const activeOrganizationId = await authStorage.getActiveOrganizationId();
        if (activeOrganizationId) {
            config.headers['x-active-organization-id'] = activeOrganizationId;
        }
    }

    return config;
});

// --- RESPONSE INTERCEPTOR: refresh silencioso em 401 ---
let isRefreshing = false;
let failedQueue: Array<{ resolve: (token: string) => void; reject: (err: any) => void }> = [];

function processQueue(error: any, token: string | null) {
    failedQueue.forEach(({ resolve, reject }) => {
        if (error) reject(error);
        else resolve(token!);
    });
    failedQueue = [];
}

api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const status = error.response?.status;
        const originalRequest = error.config;

        if (status !== 401 || originalRequest?._retry || originalRequest?.url?.includes('/auth/refresh')) {
            return Promise.reject(error);
        }

        if (!_refreshToken) {
            await authStorage.clear();
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

        try {
            const { data } = await api.post('/auth/refresh', { refresh_token: _refreshToken });
            await authStorage.setTokens(data.access_token, data.refresh_token);
            processQueue(null, data.access_token);
            originalRequest.headers['Authorization'] = `Bearer ${data.access_token}`;
            return api(originalRequest);
        } catch (refreshError) {
            processQueue(refreshError, null);
            await authStorage.clear();
            return Promise.reject(refreshError);
        } finally {
            isRefreshing = false;
        }
    },
);
