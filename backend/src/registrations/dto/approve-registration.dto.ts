// backend/src/registrations/dto/approve-registration.dto.ts
//
// Corpo do PATCH :id/approve — sobrepõe (não substitui: campo ausente mantém o que a
// pessoa enviou) os 4 campos opcionais de perfil, cobrindo o que a academia não expôs no
// formulário público mas quer registrar na hora de aprovar. Sem name/email/phone/role: a
// conta usa exatamente o que veio na solicitação e é sempre Role.ORG_USER (ver
// RegistrationsService.approve) — autocadastro nunca é caminho pra virar ORG_ADMIN.

import { IsOptional, IsDateString, IsEnum, IsArray, IsString } from 'class-validator';
import { PioneerStatus } from '@prisma/client';

export class ApproveRegistrationDto {
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
