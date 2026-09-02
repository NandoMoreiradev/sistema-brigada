import { IsOptional, IsString, IsInt, Min } from 'class-validator';
import { Transform } from 'class-transformer';

export class ListOrganizationsDto {
    @IsOptional()
    @IsString()
    search?: string;

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
