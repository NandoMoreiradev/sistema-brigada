// backend/src/courses/dto/create-course.dto.ts
//
// `Course` é o "detalhe" de um `Event` com kind=TURMA (ver schema.prisma e
// decisão 2 do docs/decisoes.md) — por isso os campos do tronco do evento
// (title/location/startDate/endDate) entram no mesmo DTO de criação da turma;
// `CoursesService.create` cria os dois registros numa transação.

import {
    IsString,
    IsNotEmpty,
    IsOptional,
    IsDateString,
    IsInt,
    Min,
    Max,
    IsBoolean,
    IsArray,
} from 'class-validator';

export class CreateCourseDto {
    @IsString()
    @IsNotEmpty({ message: 'O título da turma não pode ser vazio.' })
    title: string;

    @IsString()
    @IsOptional()
    location?: string;

    @IsDateString()
    startDate: string;

    @IsOptional()
    @IsDateString()
    endDate?: string;

    /** Ex: "Brigada de Incêndio", "Primeiros Socorros". */
    @IsString()
    @IsOptional()
    category?: string;

    @IsInt()
    @Min(1)
    @IsOptional()
    vacancies?: number;

    /** Critério de emissão automática do certificado (decisão 17). */
    @IsInt()
    @Min(0)
    @Max(100)
    @IsOptional()
    minAttendancePercent?: number;

    @IsBoolean()
    @IsOptional()
    requireAllLessonsWatched?: boolean;

    /** Validade em meses do certificado emitido nesta turma (decisão 19). */
    @IsInt()
    @Min(1)
    @IsOptional()
    recyclingValidityMonths?: number;

    @IsString()
    @IsOptional()
    recommendedRecyclingCourseId?: string;

    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    instructorUserIds?: string[];
}
