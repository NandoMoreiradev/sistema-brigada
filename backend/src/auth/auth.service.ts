// backend/src/auth/auth.service.ts
//
// Adaptado de maskotCrmEdu/backend/src/auth/auth.service.ts. Mudanças
// principais em relação ao original:
//
// - schoolId -> organizationId, School -> Organization, UserSchoolAccess ->
//   UserOrganizationAccess; `buildSchoolPermissionsMap` virou
//   `buildOrganizationPermissionsMap` (mesma lógica).
// - REMOVIDO: signUp/billing/Stripe (decisão 5 do plano de produto — onboarding
//   de organização é manual pelo SUPER_ADMIN, sem autocadastro; decisão 4 — sem
//   módulo financeiro no MVP), Mixpanel, AccessLogService (não portado — sem
//   destino/model neste schema; os pontos onde ele era chamado viraram apenas
//   `logger.log`, sem persistência de trilha de acesso).
// - `RefreshToken` neste schema não tem `isRevoked`/`familyId` (só
//   id/userId/token/expiresAt) — a detecção de "reuso de token roubado por
//   família" do original não é reproduzível aqui. A rotação ainda existe
//   (token antigo é apagado, um novo é emitido), só sem essa camada extra de
//   detecção. Ver comentário em `rotateRefreshToken`.
// - Não usa mais UsersService — os dois métodos que a auth.service usava dela
//   (findByEmail/findById) foram inlinados aqui via PrismaService, para não
//   precisar criar um módulo `users/` inteiro só para isso nesta tarefa.

import {
    Injectable,
    UnauthorizedException,
    Logger,
    NotFoundException,
    BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { Role, Prisma, User } from '@prisma/client';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { TwoFactorAuthService } from './two-factor-auth.service';
import { ConfigService } from '@nestjs/config';
import { EmailService } from '../common/email.service';

// Hash bcrypt válido, computado uma única vez no carregamento do módulo. Usado
// como alvo de comparação quando o e-mail não existe, para igualar o tempo de
// resposta do login e impedir enumeração de usuários por timing.
const DUMMY_BCRYPT_HASH = bcrypt.hashSync('brigada-dummy-timing-guard', 10);

type UserWithProfileRelations = Prisma.UserGetPayload<{
    include: {
        organization: true;
        systemRole: { select: { id: true; name: true; permissions: true } };
        roleAssignments: { include: { permissions: { select: { id: true } } } };
        allowedOrganizations: {
            include: {
                organization: true;
                roleAssignment: { include: { permissions: { select: { id: true } } } };
            };
        };
    };
}>;

@Injectable()
export class AuthService {
    private readonly logger = new Logger(AuthService.name);

    constructor(
        private jwtService: JwtService,
        private prisma: PrismaService,
        private emailService: EmailService,
        private twoFactorAuthService: TwoFactorAuthService,
        private readonly configService: ConfigService,
    ) {}

    // ─── Lookups usados pelo login/refresh (substituem UsersService) ─────────

    async findUserByEmail(email: string) {
        return this.prisma.user.findUnique({ where: { email } });
    }

    async findUserById(id: string) {
        return this.prisma.user.findUnique({ where: { id } });
    }

    // ─── Perfil ────────────────────────────────────────────────────────────

    async getProfile(userId: string, activeOrganizationId?: string) {
        const userWithRelations = (await this.prisma.user.findUnique({
            where: { id: userId },
            include: {
                organization: true,
                systemRole: { select: { id: true, name: true, permissions: true } },
                roleAssignments: { include: { permissions: { select: { id: true } } } },
                allowedOrganizations: {
                    include: {
                        organization: true,
                        roleAssignment: { include: { permissions: { select: { id: true } } } },
                    },
                },
            },
        })) as UserWithProfileRelations | null;

        if (!userWithRelations) {
            this.logger.error(`Tentativa de buscar perfil para um usuário inexistente: ${userId}`);
            throw new NotFoundException('Usuário não encontrado.');
        }

        // Mapa { organizationId: string[] } de permissões por unidade acessível.
        const organizationPermissions = this.buildOrganizationPermissionsMap(userWithRelations);
        const scopedPermissions =
            (activeOrganizationId && organizationPermissions[activeOrganizationId]) ||
            (userWithRelations.organizationId && organizationPermissions[userWithRelations.organizationId]) ||
            Array.from(
                new Set([
                    ...userWithRelations.directPermissions,
                    ...userWithRelations.roleAssignments.flatMap((r) => r.permissions.map((p) => p.id)),
                ]),
            );

        const accessibleOrganizationsMap = new Map<string, any>();
        if (userWithRelations.organization) {
            accessibleOrganizationsMap.set(userWithRelations.organization.id, userWithRelations.organization);
        }
        userWithRelations.allowedOrganizations.forEach((access) => {
            if (access.organization) {
                accessibleOrganizationsMap.set(access.organization.id, access.organization);
            }
        });

        // Expansão de hierarquia para GROUP_ADMIN: um admin de grupo enxerga toda
        // a matriz + filiais, mesmo sem UserOrganizationAccess explícito.
        if (userWithRelations.role === Role.GROUP_ADMIN && userWithRelations.organizationId) {
            const matrixOrganization = await this.prisma.organization.findFirst({
                where: {
                    OR: [
                        { id: userWithRelations.organizationId, isMatrix: true },
                        { childOrganizations: { some: { id: userWithRelations.organizationId } } },
                    ],
                    isMatrix: true,
                },
                select: { id: true },
            });

            if (matrixOrganization) {
                const groupOrganizations = await this.prisma.organization.findMany({
                    where: {
                        OR: [{ id: matrixOrganization.id }, { parentOrganizationId: matrixOrganization.id }],
                        deletedAt: null,
                    },
                });

                groupOrganizations.forEach((organization) => {
                    accessibleOrganizationsMap.set(organization.id, organization);
                });
            }
        }

        const accessibleOrganizations = Array.from(accessibleOrganizationsMap.values());

        const { password, twoFactorSecret, roleAssignments, allowedOrganizations, ...userProfile } =
            userWithRelations;

        return {
            ...userProfile,
            allowedOrganizations: accessibleOrganizations,
            permissions: scopedPermissions,
            organizationPermissions,
            isSuperAdminRoot: userWithRelations.isSuperAdminRoot,
            systemRoleId: userWithRelations.systemRoleId,
            systemRole: userWithRelations.systemRole,
        };
    }

    /**
     * Constrói o mapa { organizationId: string[] } de permissões por unidade
     * acessível.
     * - GROUP_ADMIN / SUPER_ADMIN são "organization-independent": a união
     *   completa de permissões vale em qualquer unidade.
     * - Demais usuários: cada unidade usa o cargo (RoleAssignment) daquela
     *   unidade — a unidade-mãe via `user.roleAssignments`, as demais via
     *   `allowedOrganizations[].roleAssignment`. `directPermissions` somam-se em
     *   todas as unidades.
     *
     * Equivalente a `buildSchoolPermissionsMap` do maskotCrmEdu.
     */
    private buildOrganizationPermissionsMap(user: {
        organizationId: string | null;
        role: Role;
        directPermissions: string[];
        roleAssignments: { organizationId: string; permissions: { id: string }[] }[];
        allowedOrganizations: {
            organizationId: string;
            roleAssignment: { permissions: { id: string }[] } | null;
        }[];
    }): Record<string, string[]> {
        const directPerms = user.directPermissions ?? [];
        const map: Record<string, string[]> = {};

        const organizationIds = new Set<string>();
        if (user.organizationId) organizationIds.add(user.organizationId);
        user.allowedOrganizations.forEach((a) => organizationIds.add(a.organizationId));

        if (user.role === Role.GROUP_ADMIN || user.role === Role.SUPER_ADMIN) {
            const union = new Set<string>(directPerms);
            user.roleAssignments.forEach((r) => r.permissions.forEach((p) => union.add(p.id)));
            const unionArr = Array.from(union);
            organizationIds.forEach((id) => (map[id] = unionArr));
            return map;
        }

        const permsByRoleOrganization = new Map<string, Set<string>>();
        user.roleAssignments.forEach((r) => {
            if (!permsByRoleOrganization.has(r.organizationId)) {
                permsByRoleOrganization.set(r.organizationId, new Set());
            }
            const set = permsByRoleOrganization.get(r.organizationId)!;
            r.permissions.forEach((p) => set.add(p.id));
        });

        if (user.organizationId) {
            const set = new Set<string>(permsByRoleOrganization.get(user.organizationId) ?? []);
            directPerms.forEach((p) => set.add(p));
            map[user.organizationId] = Array.from(set);
        }

        user.allowedOrganizations.forEach((access) => {
            const set = new Set<string>();
            if (access.roleAssignment?.permissions) {
                access.roleAssignment.permissions.forEach((p) => set.add(p.id));
            } else if (permsByRoleOrganization.has(access.organizationId)) {
                permsByRoleOrganization.get(access.organizationId)!.forEach((p) => set.add(p));
            }
            directPerms.forEach((p) => set.add(p));
            map[access.organizationId] = Array.from(set);
        });

        return map;
    }

    // ─── Senha: esqueci / redefinir / trocar ──────────────────────────────

    async requestPasswordReset(email: string): Promise<{ message: string }> {
        const user = await this.prisma.user.findUnique({ where: { email } });

        if (user) {
            try {
                const token = this.createPasswordResetToken(user.id);
                const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
                await this.emailService.sendPasswordResetEmail(user.email, user.name, resetLink);
            } catch (error) {
                this.logger.error(`Falha ao processar a solicitação de redefinição de senha para ${email}: ${error.message}`);
            }
        } else {
            this.logger.warn(`Solicitação de redefinição para e-mail não cadastrado: ${email}. Nenhuma ação foi tomada.`);
        }

        return {
            message: 'Se um usuário com este e-mail existir em nossa base de dados, um link para redefinição de senha será enviado.',
        };
    }

    async resetPassword(resetPasswordDto: ResetPasswordDto): Promise<{ message: string }> {
        const { token, newPassword } = resetPasswordDto;

        let userId: string;
        try {
            const payload = this.jwtService.verify<{ sub: string; purpose: string }>(token);
            if (payload.purpose !== 'password-reset') {
                throw new Error('purpose inválido');
            }
            userId = payload.sub;
        } catch {
            throw new BadRequestException('Token de redefinição inválido ou expirado.');
        }

        const hashedNewPassword = await bcrypt.hash(newPassword, 10);

        await this.prisma.$transaction(async (tx) => {
            await tx.user.update({
                where: { id: userId },
                data: { password: hashedNewPassword },
            });

            // Revoga TODAS as sessões ativas do usuário.
            await tx.refreshToken.deleteMany({ where: { userId } });
        });

        this.logger.log(`Senha redefinida com sucesso para o usuário ID: ${userId}`);

        return { message: 'Sua senha foi redefinida com sucesso.' };
    }

    async changePassword(userId: string, data: ChangePasswordDto): Promise<{ message: string }> {
        const { currentPassword, newPassword } = data;
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user) throw new NotFoundException('Usuário não encontrado.');

        const isPasswordMatching = await bcrypt.compare(currentPassword, user.password);
        if (!isPasswordMatching) throw new BadRequestException('A senha atual está incorreta.');

        const hashedNewPassword = await bcrypt.hash(newPassword, 10);
        await this.prisma.user.update({
            where: { id: userId },
            data: { password: hashedNewPassword },
        });

        // Invalida todas as sessões após a troca de senha.
        await this.prisma.refreshToken.deleteMany({ where: { userId } });

        return { message: 'Senha alterada com sucesso.' };
    }

    /**
     * Token de redefinição de senha assinado como JWT (stateless), com
     * `purpose: 'password-reset'` e expiração curta.
     *
     * DESVIO DO ORIGINAL: o maskotCrmEdu guarda esse token num model
     * `PasswordResetToken` dedicado (id/userId/token/expiresAt), que este
     * schema não tem. Em vez de inventar um model novo (fora do escopo desta
     * tarefa — o schema já está fechado), reaproveitei o padrão que o próprio
     * projeto-fonte já usa para o link de reagendamento de visita
     * (`createVisitRescheduleToken`, também um JWT assinado). Trade-off aceito:
     * sem tabela, o token não pode ser invalidado individualmente antes de
     * expirar (ex.: ao emitir um segundo pedido de reset, o primeiro token
     * ainda funcionaria até expirar) — aceitável para uma janela curta (1h).
     */
    private createPasswordResetToken(userId: string): string {
        return this.jwtService.sign(
            { sub: userId, purpose: 'password-reset' },
            { secret: this.configService.get<string>('JWT_SECRET'), expiresIn: '1h' },
        );
    }

    // ─── Login ─────────────────────────────────────────────────────────────

    async validateUser(email: string, pass: string): Promise<any> {
        const user = await this.findUserByEmail(email);

        // Anti-enumeração por timing: SEMPRE executa um bcrypt.compare, mesmo
        // quando o e-mail não existe (usando um hash dummy).
        const hashToCompare = user?.password ?? DUMMY_BCRYPT_HASH;
        const passwordMatches = await bcrypt.compare(pass, hashToCompare);

        if (user && passwordMatches && user.isActive) {
            const { password, twoFactorSecret, ...result } = user;
            return result;
        }
        return null;
    }

    async login(user: Omit<User, 'password'>) {
        if (user.isTwoFactorEnabled) {
            const payload = {
                sub: user.id,
                email: user.email,
                name: user.name,
                organizationId: user.organizationId,
                isTwoFactorAuthenticated: false,
                purpose: '2fa-verification',
            };

            const tempToken = this.jwtService.sign(payload, {
                secret: this.configService.get<string>('JWT_SECRET'),
                expiresIn: '5m',
            });

            return {
                message: '2FA required',
                twoFactorEnabled: true,
                temp_token: tempToken,
            };
        }

        const { access_token } = await this.generateFinalAccessToken(user);
        const rawRefreshToken = await this.generateRefreshToken(user.id);
        return { access_token, rawRefreshToken };
    }

    async loginWith2fa(userId: string, code: string) {
        const user = await this.findUserById(userId);
        if (!user || !user.twoFactorSecret || !user.isTwoFactorEnabled) {
            throw new UnauthorizedException('2FA não está ativo ou usuário não encontrado.');
        }

        const isCodeValid = this.twoFactorAuthService.isTokenValid(code, user.twoFactorSecret);

        if (!isCodeValid) {
            const recoveryIndex = this.twoFactorAuthService.findMatchingRecoveryCode(
                code,
                user.twoFactorRecoveryCodes ?? [],
            );

            if (recoveryIndex === -1) {
                throw new UnauthorizedException('Código 2FA inválido.');
            }

            const remaining = [...user.twoFactorRecoveryCodes];
            remaining.splice(recoveryIndex, 1);
            await this.prisma.user.update({
                where: { id: user.id },
                data: { twoFactorRecoveryCodes: remaining },
            });

            this.logger.warn(`2FA: login por CÓDIGO DE RECUPERAÇÃO para ${user.email}. Restam ${remaining.length} código(s).`);
        }

        const { password, twoFactorSecret, ...userWithoutSecrets } = user;
        const { access_token } = await this.generateFinalAccessToken(userWithoutSecrets);
        const rawRefreshToken = await this.generateRefreshToken(user.id);
        return { access_token, rawRefreshToken };
    }

    private async generateFinalAccessToken(user: Omit<User, 'password' | 'twoFactorSecret'>) {
        let allowedOrganizationIds: string[] = [];
        if (user.organizationId) {
            allowedOrganizationIds.push(user.organizationId);
        }
        const organizationAccess = await this.prisma.userOrganizationAccess.findMany({
            where: { userId: user.id },
            select: { organizationId: true },
        });
        allowedOrganizationIds.push(...organizationAccess.map((a) => a.organizationId));

        if (user.role === Role.GROUP_ADMIN && user.organizationId) {
            const matrixOrganization = await this.prisma.organization.findFirst({
                where: {
                    OR: [
                        { id: user.organizationId, isMatrix: true },
                        { childOrganizations: { some: { id: user.organizationId } } },
                    ],
                    isMatrix: true,
                },
                include: { childOrganizations: { select: { id: true } } },
            });
            if (matrixOrganization) {
                allowedOrganizationIds.push(
                    matrixOrganization.id,
                    ...matrixOrganization.childOrganizations.map((child) => child.id),
                );
            }
        }

        const uniqueAllowedOrganizationIds = [...new Set(allowedOrganizationIds)];

        const profileData = await this.getProfile(user.id);

        const payload = {
            email: user.email,
            name: user.name,
            phone: user.phone,
            avatarUrl: user.avatarUrl,
            sub: user.id,
            role: user.role,
            organizationId: user.organizationId,
            allowedOrganizations: uniqueAllowedOrganizationIds,
            organizationPermissions: profileData.organizationPermissions,
            permissions: profileData.permissions,
            isTwoFactorAuthenticated: true,
            isSuperAdminRoot: profileData.isSuperAdminRoot,
            systemRoleId: profileData.systemRoleId,
            systemRole: profileData.systemRole,
        };

        const access_token = this.jwtService.sign(payload, {
            expiresIn: this.configService.get('ACCESS_TOKEN_EXPIRES_IN') ?? '15m',
        });

        return { access_token };
    }

    // ─── Refresh Token ─────────────────────────────────────────────────────
    //
    // Este schema só tem { id, userId, token, expiresAt, createdAt } — sem
    // isRevoked/familyId. `token` guarda o HASH (sha256) do valor bruto, nunca o
    // valor em si. Rotação: apaga a linha antiga, cria uma nova. Sem a detecção
    // de "reuso de token de uma família já revogada" do maskotCrmEdu (exigiria
    // as colunas extras) — um token já rotacionado simplesmente deixa de ser
    // encontrado (mesmo efeito de "expirado" do ponto de vista do cliente).

    private hashToken(rawToken: string): string {
        return crypto.createHash('sha256').update(rawToken).digest('hex');
    }

    private async generateRefreshToken(userId: string): Promise<string> {
        const rawToken = crypto.randomBytes(64).toString('hex');
        const tokenHash = this.hashToken(rawToken);
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 dias

        await this.prisma.refreshToken.create({
            data: { token: tokenHash, userId, expiresAt },
        });

        return rawToken;
    }

    async rotateRefreshToken(rawToken: string): Promise<{ access_token: string; rawRefreshToken: string }> {
        const tokenHash = this.hashToken(rawToken);
        const stored = await this.prisma.refreshToken.findUnique({ where: { token: tokenHash } });

        if (!stored || new Date() > stored.expiresAt) {
            throw new UnauthorizedException('Refresh token inválido ou expirado.');
        }

        await this.prisma.refreshToken.delete({ where: { id: stored.id } });

        const { access_token } = await this.createTokenForUser(stored.userId);
        const rawRefreshToken = await this.generateRefreshToken(stored.userId);

        return { access_token, rawRefreshToken };
    }

    async revokeRefreshToken(rawToken: string): Promise<void> {
        const tokenHash = this.hashToken(rawToken);
        await this.prisma.refreshToken.deleteMany({ where: { token: tokenHash } });
    }

    async cleanupExpiredRefreshTokens(): Promise<number> {
        const result = await this.prisma.refreshToken.deleteMany({
            where: { expiresAt: { lt: new Date() } },
        });
        return result.count;
    }

    async createTokenForUser(userId: string): Promise<{ access_token: string }> {
        const user = await this.findUserById(userId);
        if (!user) {
            throw new NotFoundException(`Usuário com ID ${userId} não encontrado.`);
        }
        const { password, twoFactorSecret, ...userWithoutSecrets } = user;
        return this.generateFinalAccessToken(userWithoutSecrets);
    }

    // ─── Perfil / 2FA ──────────────────────────────────────────────────────

    async updateProfile(userId: string, data: UpdateProfileDto) {
        const { name, phone, avatarUrl } = data;

        const updatedUser = await this.prisma.user.update({
            where: { id: userId },
            data: {
                name,
                phone,
                ...(avatarUrl !== undefined && { avatarUrl }),
            },
        });

        return this.generateFinalAccessToken(updatedUser);
    }

    async setTwoFactorAuthSecret(secret: string, userId: string): Promise<void> {
        await this.prisma.user.update({
            where: { id: userId },
            data: { twoFactorSecret: secret },
        });
    }

    async turnOnTwoFactorAuth(userId: string, code: string) {
        const user = await this.findUserById(userId);
        if (!user || !user.twoFactorSecret) {
            throw new BadRequestException('Segredo 2FA não encontrado. Por favor, gere um novo QR Code.');
        }

        const isCodeValid = this.twoFactorAuthService.isTokenValid(code, user.twoFactorSecret);
        if (!isCodeValid) {
            throw new UnauthorizedException('Código de autenticação inválido.');
        }

        const { plainCodes, hashedCodes } = this.twoFactorAuthService.generateRecoveryCodes();

        await this.prisma.user.update({
            where: { id: userId },
            data: {
                isTwoFactorEnabled: true,
                twoFactorRecoveryCodes: hashedCodes,
            },
        });

        return {
            message: '2FA ativado com sucesso.',
            recoveryCodes: plainCodes,
        };
    }

    async turnOffTwoFactorAuth(userId: string, code: string) {
        const user = await this.findUserById(userId);
        if (!user || !user.isTwoFactorEnabled || !user.twoFactorSecret) {
            throw new BadRequestException('2FA não está ativo para este usuário.');
        }

        const isCodeValid = this.twoFactorAuthService.isTokenValid(code, user.twoFactorSecret);
        if (!isCodeValid) {
            throw new UnauthorizedException('Código de autenticação inválido.');
        }

        await this.prisma.user.update({
            where: { id: userId },
            data: {
                isTwoFactorEnabled: false,
                twoFactorSecret: null,
                twoFactorRecoveryCodes: [],
            },
        });

        return { message: '2FA desativado com sucesso.' };
    }
}
