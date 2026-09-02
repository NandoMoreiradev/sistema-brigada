// backend/src/organizations/dto/create-organization.dto.ts
//
// Onboarding de academia-cliente é manual, feito pelo SUPER_ADMIN da
// plataforma (decisão 5 do docs/decisoes.md — sem autocadastro no MVP).

import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsArray, IsUrl } from 'class-validator';

export class CreateOrganizationDto {
    @IsString()
    @IsNotEmpty({ message: 'O nome da academia não pode ser vazio.' })
    name: string;

    @IsString()
    @IsOptional()
    subdomain?: string;

    @IsUrl({}, { message: 'A URL do logo fornecida é inválida.' })
    @IsOptional()
    logoUrl?: string;

    @IsBoolean()
    @IsOptional()
    isMatrix?: boolean;

    @IsString()
    @IsOptional()
    parentOrganizationId?: string;

    @IsString()
    @IsOptional()
    groupName?: string;

    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    enabledModules?: string[];
}
