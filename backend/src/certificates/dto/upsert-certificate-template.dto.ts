// backend/src/certificates/dto/upsert-certificate-template.dto.ts
//
// Personalização visual do certificado/crachá por academia-cliente, já no
// MVP (decisão 21 do docs/decisoes.md). `layoutConfig` fica livre (Json) para
// não travar o schema a um layout específico antes de existir uma tela real
// de edição de layout.
//
// `null` apaga o campo; ausente (`undefined`) mantém o valor salvo. Antes só
// existia o "ausente", então uma logo enviada não saía mais.

import { IsString, IsOptional, IsUrl, IsObject, ValidateIf } from 'class-validator';

const isProvided = (_: unknown, value: unknown) => value !== null && value !== undefined;

export class UpsertCertificateTemplateDto {
    @ValidateIf(isProvided)
    @IsUrl({}, { message: 'A URL do logo fornecida é inválida.' })
    logoUrl?: string | null;

    @ValidateIf(isProvided)
    @IsString()
    signatureName?: string | null;

    @ValidateIf(isProvided)
    @IsUrl({}, { message: 'A URL da assinatura fornecida é inválida.' })
    signatureImageUrl?: string | null;

    @IsObject()
    @IsOptional()
    layoutConfig?: Record<string, unknown>;
}
