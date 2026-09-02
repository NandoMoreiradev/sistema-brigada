// backend/src/events/dto/create-event.dto.ts
//
// `Event` é o tronco polimórfico (decisão 2 do docs/decisoes.md). O kind
// TURMA é criado exclusivamente pelo módulo `courses` (que precisa da
// transação Event+Course junto) — este DTO só aceita os outros 4 kinds.
// Cada kind cria automaticamente sua tabela-filha 1:1 (EventOperation para
// assembleia/congresso/atuação, Meeting para reunião).

import { IsString, IsNotEmpty, IsOptional, IsDateString, IsIn, IsInt, Min } from 'class-validator';
import { EventKind } from '@prisma/client';

const CREATABLE_EVENT_KINDS = [EventKind.ASSEMBLEIA, EventKind.CONGRESSO, EventKind.ATUACAO_BRIGADA, EventKind.REUNIAO] as const;

export class CreateEventDto {
    @IsIn(CREATABLE_EVENT_KINDS, { message: 'Tipo de evento inválido para criação direta (turmas são criadas em /courses).' })
    kind: (typeof CREATABLE_EVENT_KINDS)[number];

    @IsString()
    @IsNotEmpty({ message: 'Informe o título do evento.' })
    title: string;

    @IsString()
    @IsOptional()
    location?: string;

    @IsDateString()
    startDate: string;

    @IsOptional()
    @IsDateString()
    endDate?: string;

    // --- Campos de EventOperation (assembleia/congresso/atuação de brigada) ---
    @IsInt()
    @Min(0)
    @IsOptional()
    estimatedAudienceCount?: number;

    @IsString()
    @IsOptional()
    notes?: string;

    // --- Campos de Meeting (reunião) ---
    @IsString()
    @IsOptional()
    agenda?: string;
}
