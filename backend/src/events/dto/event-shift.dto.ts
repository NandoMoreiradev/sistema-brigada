// backend/src/events/dto/event-shift.dto.ts
//
// Turnos do evento (EventShift): iguais para todos os postos. Datas "soltas" (sem fuso) são
// horário de parede de America/Sao_Paulo — ver common/datetime.ts.

import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsDateString, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, ValidateNested } from 'class-validator';

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export class CreateEventShiftDto {
    @IsString()
    @IsNotEmpty({ message: 'Informe o nome do turno (ex.: Manhã).' })
    @MaxLength(60, { message: 'O nome do turno não pode exceder 60 caracteres.' })
    name: string;

    @IsDateString()
    start: string;

    @IsDateString()
    end: string;
}

export class UpdateEventShiftDto {
    @IsString()
    @IsNotEmpty()
    @MaxLength(60)
    @IsOptional()
    name?: string;

    @IsDateString()
    @IsOptional()
    start?: string;

    @IsDateString()
    @IsOptional()
    end?: string;
}

/** Modelo de turno do dia (ex.: Manhã 08:00–12:00). Fim <= início significa que termina no dia seguinte. */
export class ShiftTemplateDto {
    @IsString()
    @IsNotEmpty()
    @MaxLength(60)
    name: string;

    @Matches(TIME_PATTERN, { message: 'startTime deve estar no formato HH:mm.' })
    startTime: string;

    @Matches(TIME_PATTERN, { message: 'endTime deve estar no formato HH:mm.' })
    endTime: string;
}

/** Cria vários turnos de uma vez: cada modelo é repetido em cada dia (ex.: 3 dias × Manhã/Tarde). */
export class CreateEventShiftsBulkDto {
    /** Dias no formato yyyy-MM-dd. */
    @IsArray()
    @ArrayMinSize(1, { message: 'Selecione pelo menos um dia.' })
    @ArrayMaxSize(31)
    @IsDateString({}, { each: true })
    days: string[];

    @IsArray()
    @ArrayMinSize(1, { message: 'Informe pelo menos um turno.' })
    @ArrayMaxSize(12)
    @ValidateNested({ each: true })
    @Type(() => ShiftTemplateDto)
    shifts: ShiftTemplateDto[];
}
