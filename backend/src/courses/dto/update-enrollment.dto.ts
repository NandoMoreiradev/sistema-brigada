import { IsIn } from 'class-validator';
import { EnrollmentStatus } from '@prisma/client';

const ENROLLMENT_STATUS_VALUES = Object.values(EnrollmentStatus);

export class UpdateEnrollmentDto {
    @IsIn(ENROLLMENT_STATUS_VALUES)
    status: EnrollmentStatus;
}
