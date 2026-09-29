import { IsOptional, IsString, IsDateString, IsEnum, IsArray } from 'class-validator';
import { PioneerStatus } from '@prisma/client';

/** Dados pessoais de qualquer pessoa da academia (aluno, instrutor, equipe...). */
export class PersonProfileDto {
    @IsOptional()
    @IsDateString()
    birthDate?: string;

    @IsOptional()
    @IsString()
    gender?: string;

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
