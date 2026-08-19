// backend/src/auth/types/forbidden-error-codes.ts
//
// Adaptado de maskotCrmEdu. Removidos os códigos ligados a plano/assinatura
// (MODULE_REQUIRED, PRODUCT_REQUIRED, PLAN_LIMIT_REACHED, TRIAL_EXPIRED,
// PLAN_FEATURE_REQUIRED) e a ACCESS_LEVEL_RESTRICTED (WHATSAPP_ONLY) — não há
// módulo financeiro nem AccessLevel neste projeto (decisão 4 do plano de
// produto). Mantido só o necessário para @RequirePermission.

/**
 * Códigos de erro estruturados para erros 403 (Forbidden).
 * Permite que o frontend identifique e trate cada tipo de erro de forma específica.
 */
export enum ForbiddenErrorCode {
    PERMISSION_DENIED = 'PERMISSION_DENIED',
    FORBIDDEN = 'FORBIDDEN',
}

export interface ForbiddenErrorResponse {
    statusCode: 403;
    error: ForbiddenErrorCode;
    message: string;
    details?: {
        requiredPermission?: string;
        userPermissions?: string[];
        suggestedAction?: string;
        contactAdmin?: boolean;
    };
}

export class ForbiddenErrorHelper {
    static createPermissionDeniedError(requiredPermission: string, userEmail?: string): ForbiddenErrorResponse {
        return {
            statusCode: 403,
            error: ForbiddenErrorCode.PERMISSION_DENIED,
            message: 'Você não tem permissão para realizar esta ação.',
            details: {
                requiredPermission,
                suggestedAction: 'Solicite ao administrador as permissões necessárias para acessar este recurso.',
                contactAdmin: true,
            },
        };
    }
}
