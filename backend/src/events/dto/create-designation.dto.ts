// backend/src/events/dto/create-designation.dto.ts
// Decisão 14 do docs/decisoes.md: escala com turnos, não uma designação única para o evento
// inteiro. O turno é uma entidade do evento (EventShift) — a designação aponta para ele.

import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateDesignationDto {
    @IsString()
    @IsNotEmpty()
    staffMemberId: string;

    /** Livre: "BRIGADISTA", "BOMBEIRO", "COORDENADOR"... */
    @IsString()
    @IsNotEmpty()
    role: string;

    /** Turno do evento (EventShift) em que essa pessoa atua. */
    @IsString()
    @IsNotEmpty({ message: 'Selecione o turno.' })
    shiftId: string;

    /** Posto de atuação (EventPost) onde essa pessoa vai ficar nesse turno. */
    @IsString()
    @IsOptional()
    postId?: string;

    @IsString()
    @IsOptional()
    notes?: string;
}
