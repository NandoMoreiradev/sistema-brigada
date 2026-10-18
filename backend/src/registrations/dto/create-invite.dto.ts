import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { RegistrationKind } from '@prisma/client';

export class CreateInviteDto {
    @IsEmail({}, { message: 'O e-mail informado é inválido.' })
    email: string;

    @IsOptional()
    @IsString()
    name?: string;

    @IsEnum(RegistrationKind)
    kind: RegistrationKind;

    /** Categoria com que a pessoa entra na equipe. Só vale para convite de equipe; nos demais é ignorada. */
    @IsOptional()
    @IsString()
    @IsNotEmpty()
    staffCategoryId?: string;
}
