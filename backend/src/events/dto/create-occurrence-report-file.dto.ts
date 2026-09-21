// backend/src/events/dto/create-occurrence-report-file.dto.ts
// Anexo (foto, documento) de um relatório de ocorrência — mesmo padrão de
// CreateEventFileDto: storageKey vem de upload presigned prévio (contexto
// 'occurrence-files'), externalUrl cobre o caso de só colar um link.

import { IsString, IsNotEmpty, IsOptional, IsUrl, ValidateIf } from 'class-validator';

export class CreateOccurrenceReportFileDto {
    @IsString()
    @IsNotEmpty()
    name: string;

    @ValidateIf((o) => !o.externalUrl)
    @IsString()
    @IsNotEmpty({ message: 'Informe storageKey ou externalUrl.' })
    storageKey?: string;

    @ValidateIf((o) => !o.storageKey)
    @IsUrl({}, { message: 'A URL informada é inválida.' })
    externalUrl?: string;

    @IsString()
    @IsOptional()
    mimeType?: string;
}
