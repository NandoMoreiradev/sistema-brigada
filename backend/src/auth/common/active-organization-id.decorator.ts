import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Resolve o ID da organização ativa a partir da request.
 *
 * Adaptado de maskotCrmEdu/backend/src/auth/common/active-school-id.decorator.ts
 * (schoolId -> organizationId, X-Active-School-Id -> X-Active-Organization-Id).
 *
 * SEGURANÇA (isolamento multi-tenant): a fonte da verdade é
 * `request.user.activeOrganizationId`, que a JwtStrategy já resolveu e VALIDOU
 * contra `allowedOrganizations`. O header cru é controlado pelo cliente e não
 * deve ser usado diretamente para escopar queries.
 */
export function resolveActiveOrganizationId(request: any): string | undefined {
    const user = request?.user;

    if (user?.activeOrganizationId) return user.activeOrganizationId;

    const raw = request?.headers?.['x-active-organization-id'];
    if (raw && Array.isArray(user?.allowedOrganizations) && user.allowedOrganizations.includes(raw)) {
        return raw;
    }

    return user?.organizationId ?? undefined;
}

export const ActiveOrganizationId = createParamDecorator((data: unknown, ctx: ExecutionContext): string | undefined => {
    return resolveActiveOrganizationId(ctx.switchToHttp().getRequest());
});
