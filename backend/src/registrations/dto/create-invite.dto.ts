import { IsEmail, IsEnum, IsOptional, IsString } from 'class-validator';
import { RegistrationKind } from '@prisma/client';

export class CreateInviteDto {
    @IsEmail({}, { message: 'O e-mail informado é inválido.' })
    email: string;

    @IsOptional()
    @IsString()
    name?: string;

    @IsEnum(RegistrationKind)
    kind: RegistrationKind;
}
