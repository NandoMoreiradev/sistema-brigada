import { IsOptional, IsString, IsBoolean, IsInt, Min, IsIn } from 'class-validator';
import { Transform } from 'class-transformer';
import { Role } from '@prisma/client';

export class ListUsersDto {
    @IsOptional()
    @IsString()
    search?: string;

    @IsOptional()
    @IsIn([Role.ORG_ADMIN, Role.ORG_USER])
    role?: Role;

    /** Filtra só quem tem (ou não tem) StudentProfile — usado pela tela de Alunos. */
    @IsOptional()
    @IsBoolean()
    @Transform(({ value }) => (value === undefined ? undefined : value === 'true' || value === true))
    hasStudentProfile?: boolean;

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
