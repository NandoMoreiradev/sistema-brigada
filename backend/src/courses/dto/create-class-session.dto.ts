import { IsString, IsOptional, IsDateString, Matches } from 'class-validator';

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export class CreateClassSessionDto {
    @IsDateString()
    date: string;

    @Matches(TIME_PATTERN, { message: 'startTime deve estar no formato HH:mm.' })
    startTime: string;

    @Matches(TIME_PATTERN, { message: 'endTime deve estar no formato HH:mm.' })
    endTime: string;

    @IsString()
    @IsOptional()
    roomId?: string;
}
