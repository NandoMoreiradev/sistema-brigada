// backend/src/events/dto/update-designation.dto.ts
// Edição de uma designação já criada — mesmos campos de CreateDesignationDto,
// mas todos opcionais (PATCH parcial).

import { IsString, IsNotEmpty, IsDateString, IsOptional } from 'class-validator';

export class UpdateDesignationDto {
    @IsString()
    @IsNotEmpty()
    @IsOptional()
    staffMemberId?: string;

    /** Livre: "BRIGADISTA", "BOMBEIRO", "COORDENADOR"... */
    @IsString()
    @IsNotEmpty()
    @IsOptional()
    role?: string;

    @IsDateString()
    @IsOptional()
    shiftStart?: string;

    @IsDateString()
    @IsOptional()
    shiftEnd?: string;

    /** Posto de atuação (EventPost) onde essa pessoa vai ficar nesse turno. */
    @IsString()
    @IsOptional()
    postId?: string;
}
