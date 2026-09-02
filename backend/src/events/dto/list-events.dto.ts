import { IsOptional, IsString, IsIn, IsInt, Min } from 'class-validator';
import { Transform } from 'class-transformer';
import { EventKind } from '@prisma/client';

const LISTABLE_EVENT_KINDS = [EventKind.ASSEMBLEIA, EventKind.CONGRESSO, EventKind.ATUACAO_BRIGADA, EventKind.REUNIAO] as const;

export class ListEventsDto {
    @IsOptional()
    @IsIn(LISTABLE_EVENT_KINDS)
    kind?: EventKind;

    @IsOptional()
    @IsString()
    search?: string;

    @IsOptional()
    @IsInt()
    @Min(1)
    @Transform(({ value }) => (value === undefined ? undefined : parseInt(value, 10)))
    page?: number = 1;

    @IsOptional()
    @IsInt()
    @Min(1)
    @Transform(({ value }) => (value === undefined ? undefined : parseInt(value, 10)))
    limit?: number = 20;
}
