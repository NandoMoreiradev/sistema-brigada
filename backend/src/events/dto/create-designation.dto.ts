// backend/src/events/dto/create-designation.dto.ts
// Decisão 14 do docs/decisoes.md: escala com turnos/horários, não uma
// designação única para o evento inteiro.

import { IsString, IsNotEmpty, IsDateString, IsOptional } from 'class-validator';

export class CreateDesignationDto {
    @IsString()
    @IsNotEmpty()
    staffMemberId: string;

    /** Livre: "BRIGADISTA", "BOMBEIRO", "COORDENADOR"... */
    @IsString()
    @IsNotEmpty()
    role: string;

    @IsDateString()
    shiftStart: string;

    @IsDateString()
    shiftEnd: string;

    @IsString()
    @IsOptional()
    notes?: string;
}
