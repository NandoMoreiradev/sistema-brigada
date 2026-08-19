import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
    @IsEmail({}, { message: 'O e-mail informado é inválido.' })
    @IsNotEmpty({ message: 'O e-mail não pode ser vazio.' })
    email: string;

    @IsString()
    @IsNotEmpty({ message: 'A senha não pode ser vazia.' })
    password: string;
}
