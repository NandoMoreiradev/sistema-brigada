// backend/src/auth/guard/permissions.guard.ts
//
// Adaptado de maskotCrmEdu/backend/src/auth/guard/permissions.guard.ts.
// Mantida a lógica de RequirePermission/PermissionsGuard e o bypass de
// SUPER_ADMIN (root ou via SystemRole). REMOVIDO o bloco de AccessLevel
// WHATSAPP_ONLY — este schema não tem o campo `accessLevel` em User, não
// existe o conceito de "usuário só-WhatsApp" neste produto.

import { Injectable, CanActivate, ExecutionContext, SetMetadata, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { AuthenticatedUser } from '../types/authenticated-user.type';
import { ForbiddenErrorHelper } from '../types/forbidden-error-codes';

export const PERMISSION_KEY = 'requiredPermission';
export const RequirePermission = (permission: string) => SetMetadata(PERMISSION_KEY, permission);

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

        if (!user || !user.permissions) {
            const errorResponse = ForbiddenErrorHelper.createPermissionDeniedError(requiredPermission, user?.email);
            throw new HttpException(errorResponse, HttpStatus.FORBIDDEN);
        }

        // =====================================================================
        // SUPER ADMIN
        // =====================================================================
        if (user.role === Role.SUPER_ADMIN) {
            // 1. Root Admin: acesso total irrestrito
            if (user.isSuperAdminRoot) {
                return true;
            }

            // 2. Super Admin com SystemRole: permissões granulares (ou coringa '*')
            if (user.systemRole?.permissions) {
                const hasSystemPermission = user.systemRole.permissions.some(
                    (p) => p === '*' || p === requiredPermission,
                );
                if (hasSystemPermission) {
                    return true;
                }
            }

            // Não é Root e não tem a permissão via SystemRole: bloqueia.
            const errorResponse = ForbiddenErrorHelper.createPermissionDeniedError(requiredPermission, user.email);
            throw new HttpException(errorResponse, HttpStatus.FORBIDDEN);
        }

        const hasPermission = user.permissions.includes(requiredPermission);

        if (!hasPermission) {
            const errorResponse = ForbiddenErrorHelper.createPermissionDeniedError(requiredPermission, user.email);
            throw new HttpException(errorResponse, HttpStatus.FORBIDDEN);
        }

        return true;
    }
}
