// backend/src/certificates/dto/upsert-certificate-template.dto.ts
//
// Personalização visual do certificado/crachá por academia-cliente, já no
// MVP (decisão 21 do docs/decisoes.md). `layoutConfig` é o layout do
// certificado (layout/certificate-layout.types.ts), Json no banco e validado
// por parseCertificateLayout antes de salvar.
//
// `null` apaga o campo; ausente (`undefined`) mantém o valor salvo. Antes só
// existia o "ausente", então uma logo enviada não saía mais.

import { IsString, IsUrl, IsObject, ValidateIf } from 'class-validator';

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

    /** Layout do certificado (validado em detalhe no service). `null` volta para o Clássico. */
    @ValidateIf(isProvided)
    @IsObject()
    layoutConfig?: Record<string, unknown> | null;
}
