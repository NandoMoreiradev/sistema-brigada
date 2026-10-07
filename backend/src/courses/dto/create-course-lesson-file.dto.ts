// backend/src/courses/dto/create-course-lesson-file.dto.ts
//
// Material de apoio de uma vídeo-aula — mesmo formato de CreateEventFileDto.
// `storageKey` vem de um upload feito antes via `POST /media/presigned-url`
// (contexto 'course-lesson-files'); `externalUrl` é a URL pública do arquivo
// enviado ou um link colado.

import { IsString, IsNotEmpty, IsOptional, IsUrl, ValidateIf, IsInt, Min } from 'class-validator';

export class CreateCourseLessonFileDto {
    @IsString()
    @IsNotEmpty({ message: 'Informe o nome do arquivo.' })
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

    /** Tamanho em bytes. */
    @IsInt()
    @Min(0)
    @IsOptional()
    size?: number;
}
