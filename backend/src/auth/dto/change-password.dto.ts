import { IsString, IsNotEmpty } from 'class-validator';
import { IsStrongPassword } from './is-strong-password.decorator';

export class ChangePasswordDto {
    @IsString()
    @IsNotEmpty({ message: 'A senha atual é obrigatória.' })
    currentPassword: string;

    @IsStrongPassword()
    newPassword: string;
}
