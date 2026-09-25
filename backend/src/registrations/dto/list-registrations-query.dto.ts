import { IsOptional, IsEnum, IsInt, Min } from 'class-validator';
import { Transform } from 'class-transformer';
import { RegistrationRequestStatus } from '@prisma/client';

export class ListRegistrationsQueryDto {
    @IsOptional()
    @IsEnum(RegistrationRequestStatus)
    status?: RegistrationRequestStatus;

    @IsOptional()
    @IsInt()
    @Min(1)
    @Transform(({ value }) => (value === undefined ? undefined : parseInt(value, 10)))
    page?: number = 1;

    @IsOptional()
    @IsInt()
    @Min(1)
    @Transform(({ value }) => (value === undefined ? undefined : parseInt(value, 10)))
    limit?: number = 20;
}
