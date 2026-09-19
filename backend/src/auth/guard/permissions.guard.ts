// backend/src/auth/guard/permissions.guard.ts
//
// Adaptado de maskotCrmEdu/backend/src/auth/guard/permissions.guard.ts.
// Mantida a lógica de RequirePermission/PermissionsGuard e o bypass de
// SUPER_ADMIN (root ou via SystemRole). REMOVIDO o bloco de AccessLevel
// WHATSAPP_ONLY — este schema não tem o campo `accessLevel` em User, não
// existe o conceito de "usuário só-WhatsApp" neste produto.
//
// ACRÉSCIMO (não existia no original): bypass para GROUP_ADMIN/ORG_ADMIN.
// `RoleAssignment`/`Permission` existem para DELEGAR partes da administração
// a um ORG_USER (secretaria, coordenador) — o admin "de verdade" da
// organização não deveria ficar bloqueado por não ter um cargo com aquela
// permissão específica atribuído a si mesmo.

import { Injectable, CanActivate, ExecutionContext, SetMetadata, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { AuthenticatedUser } from '../types/authenticated-user.type';
import { ForbiddenErrorHelper } from '../types/forbidden-error-codes';

export const PERMISSION_KEY = 'requiredPermission';
export const RequirePermission = (permission: string) => SetMetadata(PERMISSION_KEY, permission);

/**
 * Mesma lógica de bypass usada pelo PermissionsGuard, extraída para uso fora
 * de um guard — ex.: quando um service precisa decidir em runtime se o
 * usuário atual pode agir em nome de outro usuário (ver MeetingsService.markAttendance).
 */
export function userHasPermission(user: AuthenticatedUser | undefined, permission: string): boolean {
    if (!user || !user.permissions) {
        return false;
    }

    if (user.role === Role.SUPER_ADMIN) {
        if (user.isSuperAdminRoot) {
            return true;
        }
        if (user.systemRole?.permissions) {
            return user.systemRole.permissions.some((p) => p === '*' || p === permission);
        }
        return false;
    }

    if (user.role === Role.GROUP_ADMIN || user.role === Role.ORG_ADMIN) {
        return true;
    }

    return user.permissions.includes(permission);
}

@Injectable()
export class PermissionsGuard implements CanActivate {
    private readonly logger = new Logger(PermissionsGuard.name);

    constructor(private reflector: Reflector) {}

    canActivate(context: ExecutionContext): boolean {
        // getAllAndOverride (e não get): @RequirePermission também pode ser usado
        // no nível da classe. O handler tem precedência sobre a classe.
        const requiredPermission = this.reflector.getAllAndOverride<string>(PERMISSION_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);

        if (!requiredPermission) {
            return true;
        }

        const request = context.switchToHttp().getRequest();
        const user = request.user as AuthenticatedUser;

        if (!userHasPermission(user, requiredPermission)) {
            const errorResponse = ForbiddenErrorHelper.createPermissionDeniedError(requiredPermission, user?.email);
            throw new HttpException(errorResponse, HttpStatus.FORBIDDEN);
        }

        return true;
    }
}
