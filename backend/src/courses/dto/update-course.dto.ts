import { PartialType, OmitType } from '@nestjs/mapped-types';
import { IsIn, IsOptional } from 'class-validator';
import { EventStatus } from '@prisma/client';
import { CreateCourseDto } from './create-course.dto';

const EVENT_STATUS_VALUES = Object.values(EventStatus);

export class UpdateCourseDto extends PartialType(OmitType(CreateCourseDto, ['instructorUserIds'] as const)) {
    @IsOptional()
    @IsIn(EVENT_STATUS_VALUES)
    status?: EventStatus;
}
