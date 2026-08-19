// backend/src/auth/guard/jwt-auth.guard.ts
//
// Adaptado de maskotCrmEdu/backend/src/auth/guard/jwt-auth.guard.ts. O original
// também verificava aqui se o trial de assinatura da escola havia expirado
// (billing/Subscription) — removido: não há módulo financeiro neste projeto
// (decisão 4 do plano de produto). O que sobra é a checagem padrão do Passport
// mais o bypass de rotas marcadas com @Public().

import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorator/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
    constructor(private reflector: Reflector) {
        super();
    }

    canActivate(context: ExecutionContext) {
        const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);
        if (isPublic) {
            return true;
        }

        return super.canActivate(context);
    }
}
