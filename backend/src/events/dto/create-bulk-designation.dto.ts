// backend/src/events/dto/create-bulk-designation.dto.ts
// Escala várias pessoas de uma vez pro mesmo turno/posto — usado tanto pra
// escalar um grupo grande (28 brigadistas de uma vez) quanto pra formar uma
// dupla/trio (asTeam: true cria uma Team ligando as designações do lote).

import { IsArray, ArrayMinSize, IsString, IsNotEmpty, IsDateString, IsOptional, IsBoolean } from 'class-validator';

export class CreateBulkDesignationDto {
    @IsArray()
    @ArrayMinSize(1, { message: 'Selecione pelo menos uma pessoa para escalar.' })
    @IsString({ each: true })
    staffMemberIds: string[];

    /** Livre: "BRIGADISTA", "BOMBEIRO", "COORDENADOR"... — mesma função pra todo o lote. */
    @IsString()
    @IsNotEmpty()
    role: string;

    @IsDateString()
    shiftStart: string;

    @IsDateString()
    shiftEnd: string;

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
