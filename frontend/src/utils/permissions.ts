// frontend/src/utils/permissions.ts
//
// Espelha (só para exibição — a aplicação de verdade é no backend,
// PermissionsGuard/userHasPermission) o bypass de SUPER_ADMIN/GROUP_ADMIN/
// ORG_ADMIN: esses papéis sempre têm acesso administrativo pleno, não
// dependem de RoleAssignment. Os demais dependem de `user.permissions`
// (já resolvido pelo backend para a organização ativa).

import type { User } from '@/types';

const ADMIN_ROLES = ['SUPER_ADMIN', 'GROUP_ADMIN', 'ORG_ADMIN'];

export function hasPermission(user: User | null, permission: string): boolean {
    if (!user) return false;
    if (ADMIN_ROLES.includes(user.role)) return true;
    return !!user.permissions?.includes(permission);
}
