import { Role } from '@prisma/client';

/**
 * Representa o objeto do usuário como ele existe após a validação do token JWT.
 * Este é o tipo que o decorator @CurrentUser injetará nos controllers.
 *
 * Adaptado de maskotCrmEdu/backend/src/auth/types/authenticated-user.type.ts:
 * schoolId -> organizationId, allowedSchools -> allowedOrganizations. O campo
 * `accessLevel` (WHATSAPP_ONLY / FULL_ACCESS) não existe neste schema e foi
 * removido — não há equivalente de "usuário só-WhatsApp" neste produto.
 */
export interface AuthenticatedUser {
    id: string;
    email: string;
    role: Role;
    organizationId: string | null;
    allowedOrganizations: string[];
    name: string;
    avatarUrl: string | null;
    permissions: string[];
    activeOrganizationId?: string;

    // Papel de plataforma (SUPER_ADMIN)
    isSuperAdminRoot?: boolean;
    systemRoleId?: string | null;
    systemRole?: {
        name: string;
        permissions: string[];
    } | null;

    impersonatedBy?: {
        adminId: string;
        adminName: string;
        adminEmail: string;
    } | null;
}
