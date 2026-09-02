import { IsIn } from 'class-validator';
import { DesignationStatus } from '@prisma/client';

const DESIGNATION_STATUS_VALUES = Object.values(DesignationStatus);

export class UpdateDesignationStatusDto {
    @IsIn(DESIGNATION_STATUS_VALUES)
    status: DesignationStatus;
}
