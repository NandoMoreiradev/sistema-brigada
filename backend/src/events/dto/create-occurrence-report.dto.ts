import { IsString, IsNotEmpty, IsOptional, IsUrl } from 'class-validator';

export class CreateOccurrenceReportDto {
    /** Livre: "MEDICAL", "SAFETY", "BEHAVIORAL", "GENERAL"... */
    @IsString()
    @IsNotEmpty()
    type: string;

    @IsString()
    @IsNotEmpty()
    title: string;

    @IsString()
    @IsOptional()
    description?: string;

    /** URL pública (R2) de um áudio gravado via presigned URL (contexto 'occurrence-audio'). */
    @IsUrl({}, { message: 'A URL do áudio informada é inválida.' })
    @IsOptional()
    audioUrl?: string;
}
