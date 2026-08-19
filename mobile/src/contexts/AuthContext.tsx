// mobile/src/contexts/AuthContext.tsx
//
// Contrapartida mobile do frontend/src/contexts/AuthContext.tsx. Prioriza os
// papéis de campo (staff/brigadista/instrutor — ver docs/decisoes.md,
// decisão 12): login, usuário atual e logout. Sem 2FA/impersonation aqui —
// esses fluxos ficam no portal web (admin).

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import { api, authStorage } from '../services/api';
import type { User } from '../types';

interface SignInCredentials {
    email: string;
    password: string;
}

interface AuthContextData {
    user: User | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    signIn: (credentials: SignInCredentials) => Promise<void>;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextData | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const fetchProfile = useCallback(async () => {
        const { data } = await api.get<User>('/auth/profile');
        setUser(data);
        if (data.organizationId) {
            await authStorage.setActiveOrganizationId(data.organizationId);
        }
        return data;
    }, []);

    useEffect(() => {
        (async () => {
            const { accessToken } = await authStorage.load();
            if (accessToken) {
                try {
                    await fetchProfile();
                } catch (error) {
                    console.error('[AuthContext] Falha ao restaurar sessão:', error);
                    await authStorage.clear();
                    setUser(null);
                }
            }
            setIsLoading(false);
        })();
    }, [fetchProfile]);

    const signIn = useCallback(async ({ email, password }: SignInCredentials) => {
        const { data } = await api.post('/auth/login', { email, password });
        // Assume que o backend retorna refresh_token no corpo para clientes
        // mobile (sem cookie httpOnly disponível em React Native).
        await authStorage.setTokens(data.access_token, data.refresh_token);
        await fetchProfile();
    }, [fetchProfile]);

    const signOut = useCallback(async () => {
        try {
            await api.post('/auth/logout');
        } catch {
            // Best-effort: mesmo se a revogação no backend falhar, limpamos a sessão local.
        }
        await authStorage.clear();
        setUser(null);
    }, []);

    return (
        <AuthContext.Provider value={{ user, isLoading, isAuthenticated: !!user, signIn, signOut }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth(): AuthContextData {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth deve ser usado dentro de um AuthProvider');
    }
    return context;
}
