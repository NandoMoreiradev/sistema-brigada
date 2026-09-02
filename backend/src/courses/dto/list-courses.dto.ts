import { IsOptional, IsString, IsBoolean, IsInt, Min } from 'class-validator';
import { Transform } from 'class-transformer';

export class ListCoursesDto {
    @IsOptional()
    @IsString()
    search?: string;

    @IsOptional()
    @IsBoolean()
    @Transform(({ value }) => (value === undefined ? undefined : value === 'true' || value === true))
    active?: boolean;

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
