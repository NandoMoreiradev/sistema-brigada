import { PartialType } from '@nestjs/mapped-types';
import { IsString, IsNotEmpty, IsArray, IsBoolean, IsOptional } from 'class-validator';

export class CreateTeamDto {
    @IsString()
    @IsNotEmpty({ message: 'O nome da equipe não pode ser vazio.' })
    name: string;

    @IsArray()
    @IsString({ each: true })
    memberIds: string[];
}

export class UpdateTeamDto extends PartialType(CreateTeamDto) {
    @IsBoolean()
    @IsOptional()
    active?: boolean;
}
