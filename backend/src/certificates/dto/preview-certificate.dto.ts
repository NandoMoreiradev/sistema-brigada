import { IsObject, IsOptional, IsString, IsUrl, ValidateIf } from 'class-validator';

const isProvided = (_: unknown, value: unknown) => value !== null && value !== undefined;

/** Tudo opcional: o que não vier usa o que está salvo. O layout é validado no service. */
export class PreviewCertificateDto {
    @IsObject()
    @IsOptional()
    layout?: Record<string, unknown>;

    @ValidateIf(isProvided)
    @IsUrl({}, { message: 'A URL do logo fornecida é inválida.' })
    logoUrl?: string | null;

    @ValidateIf(isProvided)
    @IsString()
    signatureName?: string | null;

    @ValidateIf(isProvided)
    @IsUrl({}, { message: 'A URL da assinatura fornecida é inválida.' })
    signatureImageUrl?: string | null;

    /** Usa este modelo salvo (quando `layout` não vier) */
    @IsString()
    @IsOptional()
    designId?: string;

    /** Usa os dados reais desta turma (com um aluno de exemplo) */
    @IsString()
    @IsOptional()
    courseId?: string;
}
