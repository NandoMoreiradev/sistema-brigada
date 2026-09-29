// backend/src/events/dto/event-floor-plan.dto.ts
//
// Plantas baixas do evento (até 10). A partir da segunda planta o nome é obrigatório — a regra
// depende de quantas já existem, então é validada no EventFloorPlansService.

import { ArrayMaxSize, ArrayMinSize, IsArray, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateEventFloorPlanDto {
    @IsString()
    @IsOptional()
    @MaxLength(60, { message: 'O nome da planta não pode exceder 60 caracteres.' })
    name?: string;

    @IsString()
    @IsOptional()
    imageKey?: string;

    @IsString()
    @IsNotEmpty({ message: 'Envie a imagem da planta.' })
    imageUrl: string;
}

export class UpdateEventFloorPlanDto {
    @IsString()
    @IsNotEmpty({ message: 'O nome da planta não pode ficar vazio.' })
    @MaxLength(60)
    @IsOptional()
    name?: string;

    @IsString()
    @IsOptional()
    imageKey?: string;

    @IsString()
    @IsNotEmpty()
    @IsOptional()
    imageUrl?: string;
}

export class ReorderEventFloorPlansDto {
    /** Ids de TODAS as plantas do evento, na nova ordem. */
    @IsArray()
    @ArrayMinSize(1)
    @ArrayMaxSize(10)
    @IsString({ each: true })
    ids: string[];
}
