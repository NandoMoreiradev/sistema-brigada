import { PartialType, OmitType } from '@nestjs/mapped-types';
import { IsIn, IsOptional } from 'class-validator';
import { EventStatus } from '@prisma/client';
import { CreateEventDto } from './create-event.dto';

const EVENT_STATUS_VALUES = Object.values(EventStatus);

// `agenda` fica de fora: quem edita a pauta de uma reunião usa
// `PATCH /events/:eventId/meeting` (UpdateMeetingDto) — aceitar o campo aqui
// e nunca persisti-lo (events.service.ts não sabe lidar com ele) só engana
// quem estiver montando o payload deste endpoint.
export class UpdateEventDto extends PartialType(OmitType(CreateEventDto, ['kind', 'agenda'] as const)) {
    @IsOptional()
    @IsIn(EVENT_STATUS_VALUES)
    status?: EventStatus;
}
