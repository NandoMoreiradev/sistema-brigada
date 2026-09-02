// backend/src/courses/dto/create-course-lesson.dto.ts
//
// `videoUrl`/`videoKey` vêm de um upload feito antes via
// `POST /media/presigned-url` (contexto 'course-lessons') — o instrutor faz o
// upload direto pro R2 pelo browser e só manda a URL/key resultante aqui.

import { IsString, IsNotEmpty, IsOptional, IsInt, Min, IsUrl } from 'class-validator';

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

    @IsUrl({}, { message: 'A URL do vídeo fornecida é inválida.' })
    @IsOptional()
    videoUrl?: string;

    @IsString()
    @IsOptional()
    videoKey?: string;

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
