// backend/src/courses/dto/create-course-lesson.dto.ts
//
// `videos` é a lista completa de vídeos da aula, na ordem de exibição. Para
// vídeo enviado, `url`/`storageKey` vêm de um upload feito antes via
// `POST /media/presigned-url` (contexto 'course-lessons') — o instrutor faz o
// upload direto pro R2 pelo browser e só manda a URL/key resultante aqui.
// Link externo vem só com `url`. No update, mandar `videos` substitui a lista:
// item com `id` é mantido/atualizado, sem `id` é criado, o que faltar é removido.

import { Type } from 'class-transformer';
import { IsString, IsNotEmpty, IsOptional, IsInt, Min, IsUrl, IsArray, ValidateNested, MaxLength } from 'class-validator';

export class CourseLessonVideoInputDto {
    @IsString()
    @IsOptional()
    id?: string;

    @IsString()
    @IsOptional()
    @MaxLength(200)
    title?: string;

    @IsUrl({}, { message: 'A URL do vídeo fornecida é inválida.' })
    url: string;

    @IsString()
    @IsOptional()
    storageKey?: string;
}

export class CreateCourseLessonDto {
    @IsString()
    @IsNotEmpty()
    moduleId: string;

    @IsString()
    @IsNotEmpty({ message: 'Informe o título da aula.' })
    title: string;

    @IsString()
    @IsOptional()
    content?: string;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CourseLessonVideoInputDto)
    @IsOptional()
    videos?: CourseLessonVideoInputDto[];

    /** Duração em segundos. */
    @IsInt()
    @Min(0)
    @IsOptional()
    duration?: number;

    @IsInt()
    @Min(0)
    @IsOptional()
    order?: number;
}
