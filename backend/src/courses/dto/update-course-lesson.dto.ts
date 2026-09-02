import { PartialType, OmitType } from '@nestjs/mapped-types';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateCourseLessonDto } from './create-course-lesson.dto';

export class UpdateCourseLessonDto extends PartialType(OmitType(CreateCourseLessonDto, ['moduleId'] as const)) {
    @IsBoolean()
    @IsOptional()
    active?: boolean;
}
