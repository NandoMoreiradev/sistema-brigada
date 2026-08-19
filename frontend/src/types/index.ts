// frontend/src/types/index.ts
//
// Tipos mínimos do domínio, espelhando backend/prisma/schema.prisma.
// Cresce conforme as páginas reais forem implementadas — aqui só o
// suficiente para autenticação e a casca do app.

export type Role = 'SUPER_ADMIN' | 'GROUP_ADMIN' | 'ORG_ADMIN' | 'ORG_USER';

export interface Organization {
    id: string;
    name: string;
    subdomain?: string | null;
    logoUrl?: string | null;
    isMatrix: boolean;
    parentOrganizationId?: string | null;
    groupName?: string | null;
    enabledModules: string[];
}

export interface User {
    id: string;
    email: string;
    name: string;
    phone?: string | null;
    role: Role;
    organizationId?: string | null;
    avatarUrl?: string | null;
    directPermissions: string[];
    isTwoFactorEnabled: boolean;
    isSuperAdminRoot: boolean;
    isActive: boolean;

    // Preenchidos pelo backend em /auth/profile
    organization?: Organization | null;
    allowedOrganizations?: Organization[];
}
