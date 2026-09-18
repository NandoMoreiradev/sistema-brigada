// backend/src/auth/auth.module.ts
//
// Adaptado de maskotCrmEdu/backend/src/auth/auth.module.ts. Removidas as
// dependências de billing, payment gateways, analytics (Mixpanel), access-log
// e o módulo de resolução de permissões via banco (UserPermissionsModule) —
// ver comentários em auth.service.ts e strategy/jwt.strategy.ts. O e-mail
// transacional com templates (que o comentário original dizia ter sido
// removido) acabou sendo portado depois — ver transactional-email/.

import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { JwtStrategy } from './strategy/jwt.strategy';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TwoFactorAuthService } from './two-factor-auth.service';
import { Jwt2faTempStrategy } from './strategy/jwt-2fa-temp.strategy';
import { LoginAttemptsService } from './login-attempts.service';
import { CryptographyService } from '../common/cryptography.service';
import { TransactionalEmailModule } from '../transactional-email/transactional-email.module';

@Module({
    imports: [
        PassportModule,
        ConfigModule,
        TransactionalEmailModule,
        ThrottlerModule.forRoot([{ ttl: 60000, limit: 60 }]),
        JwtModule.registerAsync({
            imports: [ConfigModule],
            useFactory: async (configService: ConfigService) => ({
                secret: configService.get<string>('JWT_SECRET'),
                signOptions: {
                    expiresIn: (configService.get<string>('JWT_EXPIRES_IN') || '8h') as any,
                },
            }),
            inject: [ConfigService],
        }),
    ],
    providers: [
        AuthService,
        JwtStrategy,
        Jwt2faTempStrategy,
        TwoFactorAuthService,
        LoginAttemptsService,
        CryptographyService,
    ],
    controllers: [AuthController],
    exports: [AuthService, JwtModule, PassportModule, TwoFactorAuthService],
})
export class AuthModule {}
