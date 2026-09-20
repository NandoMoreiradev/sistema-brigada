// backend/src/users/dto/create-external-certification.dto.ts
//
// Decisão 10/32 do docs/decisoes.md: certificação/qualificação que a pessoa
// já trazia de fora (não formada por esta academia) é registro manual pelo
// admin, sem autocadastro. Presa direto ao `User` (decisão 32) — qualquer
// pessoa cadastrada pode ter uma, não só quem foi promovido a staff.

import { IsString, IsNotEmpty, IsOptional, IsDateString } from 'class-validator';

export class CreateExternalCertificationDto {
    @IsString()
    @IsNotEmpty({ message: 'Informe o nome da certificação.' })
    name: string;

    @IsString()
    @IsOptional()
    issuingOrg?: string;

    @IsOptional()
    @IsDateString()
    issuedAt?: string;

    @IsOptional()
    @IsDateString()
    expiresAt?: string;

    @IsString()
    @IsOptional()
    proofFileKey?: string;
}
