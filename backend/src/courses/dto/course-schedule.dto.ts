// backend/src/courses/dto/course-schedule.dto.ts
//
// DTOs da programação da turma (grupos, atividades, dia de cada grupo e modelos). Ver
// course-schedule.service.ts.

import { PartialType } from '@nestjs/mapped-types';
import { IsArray, IsDateString, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Matches, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ScheduleActivityKind } from '@prisma/client';

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export class CreateGroupDto {
    @IsString()
    @IsNotEmpty({ message: 'O nome do grupo não pode ser vazio.' })
    @MaxLength(60)
    name: string;

    /** Sala base do grupo. */
    @IsString()
    @IsOptional()
    roomId?: string;
}

export class UpdateGroupDto extends PartialType(CreateGroupDto) {}

class GroupAssignmentDto {
    @IsString()
    @IsNotEmpty()
    enrollmentId: string;

    /** `null` tira o aluno do grupo. */
    @IsString()
    @IsOptional()
    groupId?: string | null;
}

export class AssignGroupsDto {
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => GroupAssignmentDto)
    assignments: GroupAssignmentDto[];
}

/** Responsável pela atividade: uma equipe OU uma pessoa. */
export class ActivityAssigneeDto {
    @IsString()
    @IsOptional()
    teamId?: string;

    @IsString()
    @IsOptional()
    userId?: string;
}

export class CreateActivityDto {
    @IsString()
    @IsNotEmpty({ message: 'O nome da atividade não pode ser vazio.' })
    @MaxLength(200)
    title: string;

    @IsIn(Object.values(ScheduleActivityKind))
    @IsOptional()
    kind?: ScheduleActivityKind;

    @IsInt()
    @Min(1, { message: 'A duração deve ser de pelo menos 1 minuto.' })
    @Max(720, { message: 'A duração não pode passar de 12 horas.' })
    durationMinutes: number;

    /** Local fixo (ex.: Área da prática). `null`/vazio = sala base do grupo. */
    @IsString()
    @IsOptional()
    roomId?: string | null;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => ActivityAssigneeDto)
    @IsOptional()
    assignees?: ActivityAssigneeDto[];
}

export class UpdateActivityDto extends PartialType(CreateActivityDto) {}

export class SaveScheduleDayDto {
    /** Grupo dono da programação; vazio = turma inteira. */
    @IsString()
    @IsOptional()
    groupId?: string | null;

    @IsDateString()
    date: string;

    @Matches(TIME_PATTERN, { message: 'startTime deve estar no formato HH:mm.' })
    startTime: string;

    /** Atividades na ordem do dia. Lista vazia apaga a programação deste grupo neste dia. */
    @IsArray()
    @IsString({ each: true })
    activityIds: string[];
}

export class SaveTemplateDto {
    @IsString()
    @IsNotEmpty({ message: 'Dê um nome ao modelo.' })
    @MaxLength(120)
    name: string;
}

export class ApplyTemplateDto {
    @IsString()
    @IsNotEmpty()
    templateId: string;

    /** Data do primeiro dia da programação nesta turma. */
    @IsDateString()
    startDate: string;
}
