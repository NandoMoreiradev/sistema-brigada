// backend/src/users/dto/change-email.dto.ts
//
// Troca do e-mail de login de uma pessoa pelo administrador (ex.: o aluno perdeu o acesso ao
// e-mail antigo). Endpoint próprio em vez de campo no PATCH da pessoa: quem controla o e-mail
// controla a conta, então a troca encerra sessões e manda novo link de acesso.

import { IsEmail } from 'class-validator';
import { Transform } from 'class-transformer';

export class ChangeEmailDto {
    @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
    @IsEmail({}, { message: 'O e-mail informado é inválido.' })
    email: string;
}
