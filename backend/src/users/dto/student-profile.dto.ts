import { IsOptional, IsString, IsObject } from 'class-validator';

/** Só o que é de aluno. Nascimento, batismo etc. vão em PersonProfileDto. */
export class StudentProfileDto {
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
