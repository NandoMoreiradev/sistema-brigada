// backend/src/auth/guard/jwt-2fa-temp.guard.ts

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { JsonWebTokenError } from 'jsonwebtoken';

@Injectable()
export class Jwt2faTempGuard extends AuthGuard('jwt-2fa-temp') {
    handleRequest(err: any, user: any, info: any) {
        if (info instanceof JsonWebTokenError) {
            throw new UnauthorizedException('Token inválido ou expirado.');
        }

        if (err || !user) {
            throw err || new UnauthorizedException('Acesso não autorizado.');
        }

        return user;
    }
}
