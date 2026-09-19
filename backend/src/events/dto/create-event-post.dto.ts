// backend/src/events/dto/create-event-post.dto.ts
// Posto de atuação dentro do evento (ex.: "Portão A", "Palco", "Enfermaria").
// posX/posY são a posição relativa (0 a 1) na imagem da planta baixa — ficam
// opcionais porque o posto pode ser criado antes de posicionado no mapa.

import { IsString, IsNotEmpty, IsOptional, IsInt, Min, IsNumber, Max } from 'class-validator';

export class CreateEventPostDto {
    @IsString()
    @IsNotEmpty({ message: 'Informe o nome do posto.' })
    name: string;

    @IsInt()
    @Min(1)
    @IsOptional()
    capacity?: number;

    @IsString()
    @IsOptional()
    notes?: string;

    @IsNumber()
    @Min(0)
    @Max(1)
    @IsOptional()
    posX?: number;

    @IsNumber()
    @Min(0)
    @Max(1)
    @IsOptional()
    posY?: number;
}
