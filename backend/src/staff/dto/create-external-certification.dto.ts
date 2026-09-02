// backend/src/staff/dto/create-external-certification.dto.ts
//
// Decisão 10 do docs/decisoes.md: certificação de profissional externo (não
// formado pela escola) é registro manual pelo admin, sem autocadastro.

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
