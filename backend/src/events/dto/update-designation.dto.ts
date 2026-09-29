// backend/src/events/dto/update-designation.dto.ts
// Edição de uma designação já criada — mesmos campos de CreateDesignationDto,
// mas todos opcionais (PATCH parcial).

import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

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

    /** Move a pessoa para outro turno do evento. */
    @IsString()
    @IsNotEmpty()
    @IsOptional()
    shiftId?: string;

    /** Posto de atuação (EventPost). `null` tira a pessoa do posto. */
    @IsString()
    @IsOptional()
    postId?: string | null;
}
