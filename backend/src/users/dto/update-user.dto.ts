import { IsString, IsOptional, IsBoolean, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { StudentProfileDto } from './student-profile.dto';
import { PersonProfileDto } from './person-profile.dto';

export class UpdateUserDto {
    @IsString()
    @IsOptional()
    name?: string;

    @IsString()
    @IsOptional()
    phone?: string;

    @IsBoolean()
    @IsOptional()
    isActive?: boolean;

    @IsOptional()
    @ValidateNested()
    @Type(() => StudentProfileDto)
    studentProfile?: StudentProfileDto;

    /** Dados pessoais (nascimento, batismo...): valem para qualquer papel, com ou sem perfil de aluno. */
    @IsOptional()
    @ValidateNested()
    @Type(() => PersonProfileDto)
    personProfile?: PersonProfileDto;
}
