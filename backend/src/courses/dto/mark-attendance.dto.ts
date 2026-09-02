import { IsArray, IsIn, IsString, IsNotEmpty, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { AttendanceStatus } from '@prisma/client';

const ATTENDANCE_STATUS_VALUES = Object.values(AttendanceStatus);

class AttendanceRecordDto {
    @IsString()
    @IsNotEmpty()
    enrollmentId: string;

    @IsIn(ATTENDANCE_STATUS_VALUES)
    status: AttendanceStatus;
}

export class MarkAttendanceDto {
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => AttendanceRecordDto)
    records: AttendanceRecordDto[];
}
