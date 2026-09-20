import { IsOptional, IsString, IsDateString, IsObject, IsEnum, IsArray } from 'class-validator';
import { PioneerStatus } from '@prisma/client';

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

    @IsOptional()
    @IsDateString()
    baptismDate?: string;

    @IsOptional()
    @IsEnum(PioneerStatus)
    pioneerStatus?: PioneerStatus;

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    signedPetitions?: string[];

    @IsOptional()
    @IsString()
    profession?: string;
}
