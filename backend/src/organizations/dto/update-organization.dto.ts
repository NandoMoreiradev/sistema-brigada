// backend/src/organizations/dto/update-organization.dto.ts
//
// Não herda adminName/adminEmail de CreateOrganizationDto — só fazem sentido na criação
// (definir o administrador é um passo único, não algo que se "atualiza" pelo mesmo form).
// Em compensação, ganha os campos de configuração de e-mail da academia (chave Resend
// própria + remetente), que só fazem sentido depois que a academia já existe.

import { IsOptional, IsString } from 'class-validator';
import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateOrganizationDto } from './create-organization.dto';

export class UpdateOrganizationDto extends PartialType(OmitType(CreateOrganizationDto, ['adminName', 'adminEmail'] as const)) {
    @IsOptional()
    @IsString()
    resendApiKey?: string;

    @IsOptional()
    @IsString()
    emailFromAddress?: string;

    @IsOptional()
    @IsString()
    emailFromName?: string;
}
