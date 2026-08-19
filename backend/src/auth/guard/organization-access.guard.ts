// backend/src/auth/guard/organization-access.guard.ts
//
// Adaptado de maskotCrmEdu/backend/src/auth/guard/school-access.guard.ts:
// School -> Organization, X-Active-School-Id -> X-Active-Organization-Id.
// Mesma lógica de bypass para SUPER_ADMIN/GROUP_ADMIN.

import { Injectable, CanActivate, ExecutionContext, ForbiddenException, BadRequestException } from '@nestjs/common';
import { Role } from '@prisma/client';

@Injectable()
export class OrganizationAccessGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest();
        const user = request.user; // vem do JwtStrategy
        const query = request.query;

        // --- 1. BYPASS PARA VISÃO CONSOLIDADA ---
        if (query?.isConsolidated === 'true') {
            return true;
        }

        // --- 2. BYPASS PARA SUPER_ADMIN (dono da plataforma) ---
        if (user && user.role === Role.SUPER_ADMIN) {
            return true;
        }

        // --- 2.1 GROUP_ADMIN: multi-organização, mas só dentro do PRÓPRIO grupo ---
        // `allowedOrganizations` já vem expandido (matriz + filiais) na emissão do
        // token (AuthService.generateFinalAccessToken).
        if (user && user.role === Role.GROUP_ADMIN) {
            const activeOrganizationIdHeader = request.headers['x-active-organization-id'];
            if (!activeOrganizationIdHeader) {
                return true;
            }
            if (user.allowedOrganizations?.includes(activeOrganizationIdHeader)) {
                return true;
            }
            throw new ForbiddenException('Você não tem permissão para acessar os dados desta organização.');
        }

        // --- 3. VALIDAÇÃO PADRÃO (VISÃO DE ORGANIZAÇÃO ÚNICA) ---
        const activeOrganizationId = request.headers['x-active-organization-id'];

        if (!activeOrganizationId) {
            throw new BadRequestException(
                'O header X-Active-Organization-Id é obrigatório para esta rota, a menos que seja uma visão consolidada.',
            );
        }

        const hasAccess = user?.allowedOrganizations?.includes(activeOrganizationId);

        if (hasAccess) {
            return true;
        } else {
            throw new ForbiddenException('Você não tem permissão para acessar os dados desta organização.');
        }
    }
}
