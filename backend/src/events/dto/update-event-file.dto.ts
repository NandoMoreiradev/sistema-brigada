// backend/src/events/dto/update-event-file.dto.ts
// Edição de um arquivo de evento já enviado — renomear ou trocar o link/arquivo.

import { IsString, IsNotEmpty, IsOptional, IsUrl } from 'class-validator';

export class UpdateEventFileDto {
    @IsString()
    @IsNotEmpty()
    @IsOptional()
    name?: string;

    @IsString()
    @IsOptional()
    storageKey?: string;

    @IsUrl({}, { message: 'A URL informada é inválida.' })
    @IsOptional()
    externalUrl?: string;

    @IsString()
    @IsOptional()
    mimeType?: string;
}
