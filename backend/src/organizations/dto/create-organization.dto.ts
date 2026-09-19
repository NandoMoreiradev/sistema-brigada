// backend/src/organizations/dto/create-organization.dto.ts
//
// Onboarding de academia-cliente é manual, feito pelo SUPER_ADMIN da
// plataforma (decisão 5 do docs/decisoes.md — sem autocadastro no MVP). O
// SUPER_ADMIN já define o administrador (ORG_ADMIN) no mesmo formulário —
// ver OrganizationsService.create(), que cria a Organization e o User admin
// numa única transação e dispara o e-mail de boas-vindas.

import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsArray, IsUrl, IsEmail } from 'class-validator';

export class CreateOrganizationDto {
    @IsString()
    @IsNotEmpty({ message: 'O nome da academia não pode ser vazio.' })
    name: string;

    @IsString()
    @IsNotEmpty({ message: 'Informe o nome do administrador da academia.' })
    adminName: string;

    @IsEmail({}, { message: 'Informe um e-mail válido para o administrador.' })
    adminEmail: string;

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
