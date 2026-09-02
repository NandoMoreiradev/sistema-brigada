import { IsIn } from 'class-validator';
import { StaffStatus } from '@prisma/client';

const STAFF_STATUS_VALUES = Object.values(StaffStatus);

export class UpdateStaffStatusDto {
    @IsIn(STAFF_STATUS_VALUES)
    status: StaffStatus;
}
