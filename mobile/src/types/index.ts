// mobile/src/types/index.ts
// Espelha frontend/src/types/index.ts — cresce conforme as telas reais forem
// implementadas (escala, presença, ocorrência).

export type Role = 'SUPER_ADMIN' | 'GROUP_ADMIN' | 'ORG_ADMIN' | 'ORG_USER';

export interface Organization {
    id: string;
    name: string;
    logoUrl?: string | null;
}

export interface User {
    id: string;
    email: string;
    name: string;
    phone?: string | null;
    role: Role;
    organizationId?: string | null;
    avatarUrl?: string | null;
    organization?: Organization | null;
}
