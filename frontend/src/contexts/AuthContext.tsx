// frontend/src/contexts/AuthContext.tsx
//
// Adaptado do AuthContext do maskotCrmEdu. Diferenças do original:
//   - `school` -> `organization`, `schoolId` -> `organizationId`
//   - localStorage key '@MaskotCRM:activeSchoolId' -> '@BrigadaApp:activeOrganizationId'
//   - Sem status de disponibilidade/presença (feature de chat/CRM, não existe aqui)
//   - Sem "visão consolidada" multi-escola (o SchoolContext do original também
//     não foi portado — fica para quando o produto precisar de fato de troca de
//     organização ativa; hoje `User.organizationId` já resolve o caso comum)

import { createContext, useState, useEffect, useContext, useCallback } from 'react';
import type { ReactNode, Dispatch, SetStateAction } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '../services/api';
import type { User, Organization } from '@/types';
import { toast } from '@/utils/toast';
import { tokenManager } from '@/services/tokenManager';
import { isPublicAccess } from '@/utils/publicRouting';

// Guard contra chamadas concorrentes (React.StrictMode double-mount + múltiplas abas)
let _pendingRefresh: Promise<any> | null = null;

/**
 * Allowlist do que pode ser persistido no localStorage.
 *
 * Este cache existe SÓ para o primeiro paint — o `/auth/profile` é buscado logo
 * em seguida e sobrescreve tudo. Por padrão nada é persistido; novos campos
 * sensíveis que o backend venha a devolver NÃO vazam para o navegador
 * automaticamente.
 */
const USER_CACHE_FIELDS = [
    'id', 'name', 'email', 'role', 'avatarUrl', 'organizationId',
    'directPermissions', 'isSuperAdminRoot', 'isTwoFactorEnabled',
] as const;

const ORGANIZATION_CACHE_FIELDS = [
    'id', 'name', 'logoUrl', 'groupName', 'isMatrix', 'parentOrganizationId', 'enabledModules',
] as const;

function pick(source: any, fields: readonly string[]): any {
    if (!source || typeof source !== 'object') return source;
    const out: any = {};
    for (const field of fields) {
        if (source[field] !== undefined) out[field] = source[field];
    }
    return out;
}

function toLocalCache(data: any): any {
    if (!data || typeof data !== 'object') return data;

    const cached = pick(data, USER_CACHE_FIELDS);

    if (data.organization) cached.organization = pick(data.organization, ORGANIZATION_CACHE_FIELDS);
    if (Array.isArray(data.allowedOrganizations)) {
        cached.allowedOrganizations = data.allowedOrganizations.map((o: any) => pick(o, ORGANIZATION_CACHE_FIELDS));
    }

    return cached;
}

interface SignInCredentials {
    email: string;
    password: string;
}

interface LoginStep1Response {
    access_token?: string;
    twoFactorEnabled?: boolean;
    temp_token?: string;
}

interface AuthContextData {
    user: User | null;
    organization: Organization | null;
    signIn: (credentials: SignInCredentials) => Promise<LoginStep1Response>;
    finishSignIn: (accessToken: string) => Promise<void>;
    signOut: () => void;
    isLoading: boolean;
    isAuthenticated: boolean;
    setUser: Dispatch<SetStateAction<User | null>>;
    setOrganization: Dispatch<SetStateAction<Organization | null>>;
    fetchUserProfile: () => Promise<void>;
    updateUser: (data: Partial<User>) => void;
}

export const AuthContext = createContext({} as AuthContextData);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [organization, setOrganization] = useState<Organization | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const navigate = useNavigate();
    const location = useLocation();

    const fetchUserProfile = async () => {
        // Se já há uma busca de perfil em andamento, aguarda ela terminar.
        if (_pendingRefresh) {
            try {
                await _pendingRefresh;
                return;
            } catch {
                return;
            }
        }

        try {
            // O interceptor de api.ts já lida automaticamente com o refresh do
            // token se ele estiver expirado. Basta chamarmos o perfil.
            _pendingRefresh = api.get('/auth/profile')
                .then(response => {
                    localStorage.setItem('@BrigadaApp:user', JSON.stringify(toLocalCache(response.data)));
                    processUserData(response.data);
                    return response;
                })
                .finally(() => {
                    _pendingRefresh = null;
                });

            await _pendingRefresh;
        } catch (error) {
            console.error('[AuthContext] Falha ao buscar perfil:', error);
            tokenManager.clear();
            localStorage.removeItem('@BrigadaApp:user');
            setUser(null);
            setOrganization(null);
        } finally {
            setIsLoading(false);
        }
    };

    const processUserData = (data: any) => {
        const { organization: organizationData, allowedOrganizations, ...userData } = data;
        const fullUserData = { ...userData, allowedOrganizations };

        setUser(fullUserData);

        if (organizationData) {
            setOrganization(organizationData);
        } else if (allowedOrganizations && allowedOrganizations.length > 0) {
            setOrganization(allowedOrganizations[0]);
        } else {
            setOrganization(null);
        }
    };

    const updateUser = useCallback((data: Partial<User>) => {
        setUser((prevUser) => {
            if (!prevUser) return null;

            const updatedUser = { ...prevUser, ...data };

            try {
                const cached = JSON.parse(localStorage.getItem('@BrigadaApp:user') || '{}');
                const merged = { ...cached, ...updatedUser };
                localStorage.setItem('@BrigadaApp:user', JSON.stringify(toLocalCache(merged)));
            } catch (e) {
                console.error('Erro ao atualizar cache do usuário', e);
            }

            return updatedUser;
        });
    }, []);

    useEffect(() => {
        if (isPublicAccess(window.location)) {
            setIsLoading(false);
            return;
        }

        // Carrega cache local enquanto o refresh acontece em background (melhor UX)
        const cachedUser = localStorage.getItem('@BrigadaApp:user');
        if (cachedUser) {
            try {
                processUserData(JSON.parse(cachedUser));
            } catch (error) {
                console.error('[AuthContext] Erro ao parsear cache:', error);
            }
        }

        fetchUserProfile();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    async function signIn({ email, password }: SignInCredentials): Promise<LoginStep1Response> {
        const response = await api.post<LoginStep1Response>('/auth/login', { email, password });
        return response.data;
    }

    async function finishSignIn(accessToken: string) {
        // Guarda em memória — nunca no localStorage
        tokenManager.set(accessToken);

        try {
            const profileResponse = await api.get('/auth/profile');
            localStorage.setItem('@BrigadaApp:user', JSON.stringify(toLocalCache(profileResponse.data)));
            processUserData(profileResponse.data);

            const userData = profileResponse.data;

            if (userData.organizationId) {
                localStorage.setItem('@BrigadaApp:activeOrganizationId', userData.organizationId);
            }

            if (userData.role === 'SUPER_ADMIN') {
                navigate('/admin/organizations');
            } else {
                const origin = (location.state as any)?.from?.pathname || '/dashboard';
                navigate(origin);
            }
        } catch (error) {
            toast.error('Erro ao carregar perfil do usuário.');
            signOut();
        }
    }

    function signOut() {
        // O interceptor de request do axios roda como microtask — captura o
        // token aqui e o envia explicitamente para o /auth/logout revogar o
        // refresh token antes de limparmos o estado em memória.
        const tokenParaRevogar = tokenManager.get();
        api.post(
            '/auth/logout',
            {},
            tokenParaRevogar
                ? { headers: { Authorization: `Bearer ${tokenParaRevogar}` } }
                : undefined,
        ).catch(() => {});

        tokenManager.clearAll();
        localStorage.removeItem('@BrigadaApp:user');
        localStorage.removeItem('@BrigadaApp:activeOrganizationId');

        setUser(null);
        setOrganization(null);
        navigate('/login');
    }

    return (
        <AuthContext.Provider value={{
            user,
            organization,
            signIn,
            finishSignIn,
            signOut,
            isLoading,
            isAuthenticated: !!user,
            setUser,
            setOrganization,
            fetchUserProfile,
            updateUser,
        }}>
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
