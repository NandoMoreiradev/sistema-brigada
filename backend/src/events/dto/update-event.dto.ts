import { PartialType, OmitType } from '@nestjs/mapped-types';
import { IsIn, IsOptional } from 'class-validator';
import { EventStatus } from '@prisma/client';
import { CreateEventDto } from './create-event.dto';

const EVENT_STATUS_VALUES = Object.values(EventStatus);

export class UpdateEventDto extends PartialType(OmitType(CreateEventDto, ['kind'] as const)) {
    @IsOptional()
    @IsIn(EVENT_STATUS_VALUES)
    status?: EventStatus;
}
