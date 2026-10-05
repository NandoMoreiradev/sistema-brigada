import { IsString, IsOptional, IsDateString, Matches, IsArray, MaxLength } from 'class-validator';

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export class CreateClassSessionDto {
    @IsDateString()
    date: string;

    @Matches(TIME_PATTERN, { message: 'startTime deve estar no formato HH:mm.' })
    startTime: string;

    @Matches(TIME_PATTERN, { message: 'endTime deve estar no formato HH:mm.' })
    endTime: string;

    @IsString()
    @IsOptional()
    roomId?: string;

    /** Grupo da turma (ex.: "Sala 1"): a chamada mostra só os alunos dele. Vazio = turma inteira. */
    @IsString()
    @IsOptional()
    groupId?: string | null;

    /** Assunto/tema da aula do dia. */
    @IsString()
    @IsOptional()
    @MaxLength(200, { message: 'O assunto não pode exceder 200 caracteres.' })
    topic?: string;

    /** Professores escalados (todos precisam ser instrutores da turma). Vazio = qualquer instrutor da turma. */
    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    instructorIds?: string[];
}
