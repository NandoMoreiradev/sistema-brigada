import { IsNotEmpty, IsString } from 'class-validator';
import { IsStrongPassword } from './is-strong-password.decorator';

export class ResetPasswordDto {
    @IsString()
    @IsNotEmpty({ message: 'O token de redefinição é obrigatório.' })
    token: string;

    @IsNotEmpty({ message: 'A nova senha é obrigatória.' })
    @IsStrongPassword()
    newPassword: string;
}
