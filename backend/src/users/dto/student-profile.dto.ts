import { IsOptional, IsString, IsDateString, IsObject } from 'class-validator';

export class StudentProfileDto {
    @IsOptional()
    @IsDateString()
    birthDate?: string;

    @IsOptional()
    @IsString()
    gender?: string;

    @IsOptional()
    @IsObject()
    healthInfo?: Record<string, unknown>;

    @IsOptional()
    @IsString()
    guardianName?: string;

    @IsOptional()
    @IsString()
    guardianPhone?: string;
}
