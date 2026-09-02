// backend/src/events/dto/create-event-file.dto.ts
//
// Anexo genérico de evento (pauta, ata, comprovantes) — decisão de arquitetura
// em docs/decisoes.md: evita reimplementar um módulo Drive inteiro. `storageKey`
// vem de um upload feito antes via `POST /media/presigned-url` (contexto
// 'event-files'); `externalUrl` cobre o caso de só colar um link.

import { IsString, IsNotEmpty, IsOptional, IsUrl, ValidateIf } from 'class-validator';

export class CreateEventFileDto {
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
}
