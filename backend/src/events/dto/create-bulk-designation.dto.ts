// backend/src/events/dto/create-bulk-designation.dto.ts
// Escala várias pessoas em um ou mais turnos de uma vez — usado tanto pra escalar um grupo grande
// (28 brigadistas) quanto pra repetir a mesma escala em vários dias/turnos, quanto pra formar uma
// dupla/trio (asTeam: true cria uma Team ligando as designações do lote).

import { IsArray, ArrayMinSize, IsString, IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';

export class CreateBulkDesignationDto {
    @IsArray()
    @ArrayMinSize(1, { message: 'Selecione pelo menos uma pessoa para escalar.' })
    @IsString({ each: true })
    staffMemberIds: string[];

    /** Livre: "BRIGADISTA", "BOMBEIRO", "COORDENADOR"... — mesma função pra todo o lote. */
    @IsString()
    @IsNotEmpty()
    role: string;

    /** Turnos do evento: cada pessoa é escalada em todos eles (ex.: Dia 1 Manhã + Dia 2 Manhã e Tarde). */
    @IsArray()
    @ArrayMinSize(1, { message: 'Selecione pelo menos um turno.' })
    @IsString({ each: true })
    shiftIds: string[];

    @IsString()
    @IsOptional()
    postId?: string;

    /** Cria uma Team ligando todas as designações deste lote (dupla/trio/equipe). */
    @IsBoolean()
    @IsOptional()
    asTeam?: boolean;

    /** Nome da equipe — se vazio, gera "Dupla N"/"Trio N"/"Equipe N" automaticamente. */
    @IsString()
    @IsOptional()
    teamName?: string;
}
