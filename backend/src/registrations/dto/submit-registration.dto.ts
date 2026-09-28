// backend/src/registrations/dto/submit-registration.dto.ts
//
// Corpo do POST público (sem login) de autocadastro. nome/e-mail/telefone sempre
// obrigatórios; os 4 campos opcionais aceitam o payload mesmo que a academia não os
// tenha habilitado — RegistrationsService.submitPublic() sempre filtra pelo
// publicRegistrationFields da academia no servidor, nunca confia no formulário.

import { IsString, IsNotEmpty, IsEmail, IsOptional, IsDateString, IsEnum, IsArray } from 'class-validator';
import { PioneerStatus } from '@prisma/client';

export class SubmitRegistrationDto {
    @IsString()
    @IsNotEmpty({ message: 'O nome não pode ser vazio.' })
    name: string;

    @IsEmail({}, { message: 'O e-mail informado é inválido.' })
    email: string;

    @IsString()
    @IsNotEmpty({ message: 'O telefone não pode ser vazio.' })
    phone: string;

    @IsOptional()
    @IsDateString()
    baptismDate?: string;

    @IsOptional()
    @IsEnum(PioneerStatus)
    pioneerStatus?: PioneerStatus;

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    signedPetitions?: string[];

    @IsOptional()
    @IsString()
    profession?: string;
}
