// backend/src/communications/dto/update-communication.dto.ts
//
// Só permitido enquanto Communication.status === DRAFT (ver CommunicationBroadcastService.update)
// — depois de enviado, o conteúdo/destinatários não podem mudar mais.

import { CommunicationAudience, Prisma } from '@prisma/client';
import { IsArray, IsEnum, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateCommunicationDto {
    @IsOptional()
    @IsString()
    @MaxLength(255, { message: 'O assunto do e-mail não pode exceder 255 caracteres.' })
    subject?: string;

    @IsOptional()
    @IsString()
    @MaxLength(100000, { message: 'O corpo do e-mail não pode exceder 100.000 caracteres.' })
    body?: string;

    @IsOptional()
    @IsObject({ message: 'O designJson deve ser um objeto JSON válido.' })
    designJson?: Prisma.JsonValue;

    @IsOptional()
    @IsEnum(CommunicationAudience, { message: 'Público-alvo inválido.' })
    audience?: CommunicationAudience;

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    customRecipientUserIds?: string[];
}
