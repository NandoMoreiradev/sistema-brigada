import { applyDecorators } from '@nestjs/common';
import { IsString, MinLength, Matches } from 'class-validator';

/**
 * Política de senha forte, centralizada para todos os pontos que definem senha
 * (reset, troca e criação/edição de usuário):
 *   - mínimo 8 caracteres
 *   - ao menos uma letra
 *   - ao menos um número
 */
export function IsStrongPassword() {
    return applyDecorators(
        IsString({ message: 'A senha deve ser um texto.' }),
        MinLength(8, { message: 'A senha deve ter no mínimo 8 caracteres.' }),
        Matches(/[A-Za-z]/, { message: 'A senha deve conter ao menos uma letra.' }),
        Matches(/[0-9]/, { message: 'A senha deve conter ao menos um número.' }),
    );
}
