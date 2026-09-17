// backend/src/auth/common/user-has-permission.util.ts
//
// Mesma checagem de bypass que PermissionsGuard aplica nas rotas
// (@RequirePermission), extraída para uso dentro de services que precisam
// combinar "tem a permissão administrativa" com "é dono do próprio dado"
// (ex.: instrutor só edita a própria turma se NÃO tiver `courses:manage`).

import { Role } from '@prisma/client';
import { AuthenticatedUser } from '../types/authenticated-user.type';

export function userHasPermission(user: AuthenticatedUser, permission: string): boolean {
    if (user.role === Role.SUPER_ADMIN) {
        if (user.isSuperAdminRoot) return true;
        return !!user.systemRole?.permissions?.some((p) => p === '*' || p === permission);
    }

    if (user.role === Role.GROUP_ADMIN || user.role === Role.ORG_ADMIN) {
        return true;
    }

    return !!user.permissions?.includes(permission);
}
