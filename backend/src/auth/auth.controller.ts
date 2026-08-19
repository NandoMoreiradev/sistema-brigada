// backend/src/auth/auth.controller.ts
//
// Adaptado de maskotCrmEdu/backend/src/auth/auth.controller.ts. REMOVIDO:
// POST /auth/signup (criação de organização + billing/Stripe — decisões 4 e 5
// do plano de produto: sem módulo financeiro, onboarding de organização é
// manual pelo SUPER_ADMIN via um futuro módulo admin, não um self-service de
// auth) e todo log via AccessLogService (não portado).

import {
    Controller,
    Post,
    Body,
    UnauthorizedException,
    Get,
    UseGuards,
    Req,
    Patch,
    ValidationPipe,
    Res,
    HttpCode,
    HttpStatus,
    Logger,
    HttpException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guard/jwt-auth.guard';
import { Request, Response } from 'express';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { TwoFactorAuthService } from './two-factor-auth.service';
import { CurrentUser } from './common/current-user.decorator';
import { AuthenticatedUser } from './types/authenticated-user.type';
import { TwoFactorAuthCodeDto } from './dto/two-factor-auth-code.dto';
import { Jwt2faTempGuard } from './guard/jwt-2fa-temp.guard';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import { LoginAttemptsService } from './login-attempts.service';

interface AuthenticatedRequest extends Request {
    user: {
        id: string;
        activeOrganizationId?: string;
    };
}

// Em produção, frontend e backend costumam estar em domínios diferentes:
// SameSite=None + Secure=true é obrigatório para cookies cross-site.
const isProduction = process.env.NODE_ENV === 'production';
const REFRESH_COOKIE_OPTIONS = {
    httpOnly: true,
    secure: isProduction,
    sameSite: (isProduction ? 'none' : 'lax') as 'none' | 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 dias
    path: '/',
};

@Controller('auth')
export class AuthController {
    private readonly logger = new Logger(AuthController.name);

    constructor(
        private authService: AuthService,
        private twoFactorAuthService: TwoFactorAuthService,
        private loginAttempts: LoginAttemptsService,
    ) {}

    @Post('forgot-password')
    @UseGuards(ThrottlerGuard)
    @Throttle({ default: { limit: 5, ttl: 60000 } })
    forgotPassword(@Body(new ValidationPipe()) forgotPasswordDto: ForgotPasswordDto) {
        return this.authService.requestPasswordReset(forgotPasswordDto.email);
    }

    @Post('reset-password')
    resetPassword(@Body(new ValidationPipe()) resetPasswordDto: ResetPasswordDto) {
        return this.authService.resetPassword(resetPasswordDto);
    }

    @Post('login')
    @UseGuards(ThrottlerGuard)
    @Throttle({ default: { limit: 10, ttl: 60000 } })
    @HttpCode(HttpStatus.OK)
    async login(
        @Body(new ValidationPipe()) loginDto: LoginDto,
        @Res({ passthrough: true }) res: Response,
    ) {
        // Lockout por conta: bloqueia após muitas falhas (complementa o
        // rate-limit por IP do ThrottlerGuard).
        const lockRemaining = await this.loginAttempts.getLockRemaining(loginDto.email);
        if (lockRemaining > 0) {
            throw new HttpException(
                {
                    message: `Muitas tentativas de login malsucedidas. Tente novamente em ${Math.ceil(lockRemaining / 60)} minuto(s).`,
                    code: 'ACCOUNT_TEMP_LOCKED',
                    retryAfter: lockRemaining,
                },
                HttpStatus.TOO_MANY_REQUESTS,
            );
        }

        const user = await this.authService.validateUser(loginDto.email, loginDto.password);

        if (!user) {
            await this.loginAttempts.recordFailure(loginDto.email);
            throw new UnauthorizedException('Credenciais inválidas.');
        }

        await this.loginAttempts.reset(loginDto.email);

        const result = await this.authService.login(user);

        // 2FA: ainda não emite refresh token (aguarda validação do código)
        if ('twoFactorEnabled' in result) return result;

        res.cookie('refresh_token', result.rawRefreshToken, REFRESH_COOKIE_OPTIONS);
        // refresh_token omitido do body intencionalmente: fica apenas no cookie httpOnly
        return { access_token: result.access_token };
    }

    @Post('2fa/authenticate')
    @UseGuards(Jwt2faTempGuard, ThrottlerGuard)
    @Throttle({ default: { limit: 10, ttl: 60000 } })
    @HttpCode(HttpStatus.OK)
    async authenticate(
        @CurrentUser() user: AuthenticatedUser,
        @Body(new ValidationPipe()) { code }: TwoFactorAuthCodeDto,
        @Res({ passthrough: true }) res: Response,
    ) {
        const result = await this.authService.loginWith2fa(user.id, code);

        res.cookie('refresh_token', result.rawRefreshToken, REFRESH_COOKIE_OPTIONS);
        return { access_token: result.access_token };
    }

    // GET /auth/me — endpoint canônico REST para "usuário autenticado atual"
    @UseGuards(JwtAuthGuard)
    @Get('me')
    getMe(@Req() req: AuthenticatedRequest) {
        return this.authService.getProfile(req.user.id, req.user.activeOrganizationId);
    }

    @UseGuards(JwtAuthGuard)
    @Get('profile')
    getProfile(@Req() req: AuthenticatedRequest) {
        return this.authService.getProfile(req.user.id, req.user.activeOrganizationId);
    }

    // POST /auth/refresh — suporta web (cookie httpOnly) e mobile (body)
    @Post('refresh')
    @HttpCode(HttpStatus.OK)
    async refreshToken(
        @Req() req: Request,
        @Res({ passthrough: true }) res: Response,
        @Body() body?: { refresh_token?: string },
    ) {
        const rawToken = (req as any).cookies?.['refresh_token'] ?? body?.refresh_token;
        if (!rawToken) throw new UnauthorizedException('Refresh token ausente.');

        const { access_token, rawRefreshToken } = await this.authService.rotateRefreshToken(rawToken);

        res.cookie('refresh_token', rawRefreshToken, REFRESH_COOKIE_OPTIONS);
        return { access_token, refresh_token: rawRefreshToken };
    }

    // POST /auth/logout — revoga o refresh token deste dispositivo e limpa o cookie
    @Post('logout')
    @UseGuards(JwtAuthGuard)
    @HttpCode(HttpStatus.OK)
    async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
        const rawToken = (req as any).cookies?.['refresh_token'];
        if (rawToken) {
            await this.authService.revokeRefreshToken(rawToken);
        }
        res.clearCookie('refresh_token', {
            path: '/',
            secure: isProduction,
            sameSite: isProduction ? 'none' : 'lax',
        });
        return { message: 'Logout realizado com sucesso.' };
    }

    @UseGuards(JwtAuthGuard)
    @Patch('profile')
    updateProfile(
        @Req() req: AuthenticatedRequest,
        @Body(new ValidationPipe()) updateProfileDto: UpdateProfileDto,
    ) {
        return this.authService.updateProfile(req.user.id, updateProfileDto);
    }

    @UseGuards(JwtAuthGuard)
    @Patch('change-password')
    changePassword(
        @Req() req: AuthenticatedRequest,
        @Body(new ValidationPipe()) changePasswordDto: ChangePasswordDto,
    ) {
        return this.authService.changePassword(req.user.id, changePasswordDto);
    }

    @Post('2fa/generate')
    @UseGuards(JwtAuthGuard)
    async generateTwoFactorAuth(@Res() response: Response, @CurrentUser() user: AuthenticatedUser) {
        const { encryptedSecret, otpauthUrl } = await this.twoFactorAuthService.generateSecret(user.email);
        await this.authService.setTwoFactorAuthSecret(encryptedSecret, user.id);
        const qrCodeDataURL = await this.twoFactorAuthService.generateQrCodeDataURL(otpauthUrl);
        response.json({ qrCodeDataURL });
    }

    @Post('2fa/turn-on')
    @HttpCode(HttpStatus.OK)
    @UseGuards(JwtAuthGuard)
    async turnOnTwoFactorAuth(
        @CurrentUser() user: AuthenticatedUser,
        @Body(new ValidationPipe()) { code }: TwoFactorAuthCodeDto,
    ) {
        return this.authService.turnOnTwoFactorAuth(user.id, code);
    }

    @Post('2fa/turn-off')
    @HttpCode(HttpStatus.OK)
    @UseGuards(JwtAuthGuard)
    async turnOffTwoFactorAuth(
        @CurrentUser() user: AuthenticatedUser,
        @Body(new ValidationPipe()) { code }: TwoFactorAuthCodeDto,
    ) {
        return this.authService.turnOffTwoFactorAuth(user.id, code);
    }

    @Post('switch-context')
    @UseGuards(JwtAuthGuard)
    @HttpCode(HttpStatus.OK)
    async switchContext(@CurrentUser() user: AuthenticatedUser, @Body() body: { organizationId?: string }) {
        if (body.organizationId) {
            this.logger.log(`[Context Switch] User ${user.id} switched to organization ${body.organizationId}.`);
        }
        return { message: 'Context switched successfully on the backend.' };
    }
}
