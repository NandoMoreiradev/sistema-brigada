// backend/src/certificates/dto/upsert-certificate-template.dto.ts
//
// Personalização visual do certificado/crachá por academia-cliente, já no
// MVP (decisão 21 do docs/decisoes.md). `layoutConfig` fica livre (Json) para
// não travar o schema a um layout específico antes de existir uma tela real
// de edição de layout.

import { IsString, IsOptional, IsUrl, IsObject } from 'class-validator';

export class UpsertCertificateTemplateDto {
    @IsUrl({}, { message: 'A URL do logo fornecida é inválida.' })
    @IsOptional()
    logoUrl?: string;

    @IsString()
    @IsOptional()
    signatureName?: string;

    @IsUrl({}, { message: 'A URL da assinatura fornecida é inválida.' })
    @IsOptional()
    signatureImageUrl?: string;

    @IsObject()
    @IsOptional()
    layoutConfig?: Record<string, unknown>;
}
