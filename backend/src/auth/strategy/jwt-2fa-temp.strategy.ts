// backend/src/auth/strategy/jwt-2fa-temp.strategy.ts

import { Injectable, InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

interface Jwt2faPayload {
    sub: string;
    email: string;
    name: string;
    organizationId: string | null;
    purpose: string;
}

@Injectable()
export class Jwt2faTempStrategy extends PassportStrategy(Strategy, 'jwt-2fa-temp') {
    constructor(private readonly configService: ConfigService) {
        const secret = configService.get<string>('JWT_SECRET');

        if (!secret) {
            throw new InternalServerErrorException('JWT_SECRET não está definido nas variáveis de ambiente.');
        }

        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: secret,
        });
    }

    async validate(payload: Jwt2faPayload) {
        if (payload.purpose !== '2fa-verification') {
            throw new UnauthorizedException('Token inválido para esta operação.');
        }
        if (!payload.sub || !payload.email) {
            throw new UnauthorizedException('Token 2FA inválido ou malformado.');
        }

        return {
            id: payload.sub,
            email: payload.email,
            name: payload.name,
            organizationId: payload.organizationId,
        };
    }
}
