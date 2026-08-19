// backend/src/auth/strategy/jwt.strategy.ts
//
// Adaptado de maskotCrmEdu/backend/src/auth/strategy/jwt.strategy.ts.
//
// SIMPLIFICAÇÃO DELIBERADA: o projeto-fonte resolve permissões em 3 modos
// (`token` | `shadow` | `db`, ver auth/permissions/permissions-source.ts),
// com um serviço de resolução via banco + cache Redis (UserPermissionsService)
// para permitir revogação quase-instantânea. Segundo a própria documentação
// daquele projeto, `token` é o modo default e seguro para produção — é o único
// modo portado aqui. Permissões viajam dentro do JWT (`organizationPermissions`
// por organização + `permissions` como fallback/união) e são revogadas quando o
// access token expira (curto, ver ACCESS_TOKEN_EXPIRES_IN). Se este projeto
// precisar de revogação mais rápida no futuro, o padrão de resolução via banco
// do maskotCrmEdu pode ser reaproveitado.

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AuthenticatedUser } from '../types/authenticated-user.type';
import { Role } from '@prisma/client';
import { Request } from 'express';

interface JwtPayload {
    sub: string;
    email: string;
    role: Role;
    organizationId: string | null;
    allowedOrganizations: string[];
    name: string;
    avatarUrl: string | null;
    // Permissões por organização acessível (cargo por unidade) + união/fallback.
    organizationPermissions?: Record<string, string[]>;
    permissions?: string[];
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

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor(private configService: ConfigService) {
        const jwtSecret = configService.get<string>('JWT_SECRET');
        if (!jwtSecret) {
            throw new Error('JWT_SECRET não está definido no ambiente. Verifique o arquivo .env');
        }
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: jwtSecret,
            passReqToCallback: true,
        });
    }

    async validate(req: Request, payload: JwtPayload): Promise<AuthenticatedUser> {
        if (!payload || !payload.sub || !payload.email || !payload.name) {
            throw new UnauthorizedException('Token inválido ou malformado.');
        }

        const rawOrganizationId = req.headers['x-active-organization-id'] as string | undefined;
        // Só SUPER_ADMIN é platform-wide de verdade. GROUP_ADMIN é dono só do
        // próprio grupo (matriz + filiais), já expandido em `allowedOrganizations`
        // na emissão do token — por isso cai na mesma checagem contra
        // allowedOrganizations que qualquer usuário comum.
        const isTrustedRole = payload.role === Role.SUPER_ADMIN;
        const allowedOrganizations = payload.allowedOrganizations;
        // Fail-closed: o header só é confiável para SUPER_ADMIN OU quando a
        // organização está explicitamente em allowedOrganizations.
        const headerIsAllowed =
            isTrustedRole ||
            (Array.isArray(allowedOrganizations) && allowedOrganizations.includes(rawOrganizationId!));
        const activeOrganizationId = rawOrganizationId
            ? headerIsAllowed
                ? rawOrganizationId
                : (payload.organizationId ?? undefined)
            : (payload.organizationId ?? undefined);

        const permissions = this.resolvePermissions(payload, activeOrganizationId);

        return {
            id: payload.sub,
            email: payload.email,
            role: payload.role,
            organizationId: payload.organizationId,
            allowedOrganizations: payload.allowedOrganizations,
            name: payload.name,
            avatarUrl: payload.avatarUrl,
            activeOrganizationId,
            permissions,
            isSuperAdminRoot: payload.isSuperAdminRoot,
            systemRoleId: payload.systemRoleId,
            systemRole: payload.systemRole,
            impersonatedBy: payload.impersonatedBy ?? null,
        };
    }

    private resolvePermissions(payload: JwtPayload, activeOrganizationId?: string): string[] {
        return (
            (activeOrganizationId && payload.organizationPermissions?.[activeOrganizationId]) ||
            payload.permissions ||
            []
        );
    }
}
