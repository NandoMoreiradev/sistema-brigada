// backend/src/auth/dto/verify-two-factor-login.dto.ts
//
// Separado de TwoFactorAuthCodeDto (usado em 2fa/turn-on) de propósito: ali o
// código é sempre um TOTP de 6 dígitos, mas no login (AuthService.loginWith2fa)
// o mesmo campo também aceita um código de recuperação (formato "xxxx-xxxx-xxxx",
// ver TwoFactorAuthService.generateRecoveryCodes) — validar como 6 dígitos aqui
// rejeitaria todo código de recuperação antes mesmo de chegar no service.

import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class VerifyTwoFactorLoginDto {
    @IsString()
    @IsNotEmpty({ message: 'Informe o código.' })
    @MaxLength(20)
    code: string;
}
