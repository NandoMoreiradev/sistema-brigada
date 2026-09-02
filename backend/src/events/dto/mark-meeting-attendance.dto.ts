import { IsArray, IsIn, IsString, IsNotEmpty, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { AttendanceStatus } from '@prisma/client';

const ATTENDANCE_STATUS_VALUES = Object.values(AttendanceStatus);

class MeetingAttendanceRecordDto {
    @IsString()
    @IsNotEmpty()
    userId: string;

    @IsIn(ATTENDANCE_STATUS_VALUES)
    status: AttendanceStatus;
}

export class MarkMeetingAttendanceDto {
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => MeetingAttendanceRecordDto)
    records: MeetingAttendanceRecordDto[];
}
