import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Decorator de parâmetro de rota para extrair o usuário atual da requisição.
 * O usuário vem do JwtStrategy após a autenticação.
 */
export const CurrentUser = createParamDecorator((data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;
    return data ? user?.[data] : user;
});
