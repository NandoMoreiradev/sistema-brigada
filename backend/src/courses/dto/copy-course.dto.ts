import { IsBoolean, IsDateString, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CopyCourseContentDto {
    /** Turma de onde sai o conteúdo (a turma de destino é a da rota). */
    @IsString()
    @IsNotEmpty()
    sourceCourseId: string;

    /** Data do primeiro dia da turma nova: as datas copiadas são deslocadas a partir dela, mantendo os intervalos. */
    @IsOptional()
    @IsDateString()
    startDate?: string;

    /** Aulas avulsas da agenda (as geradas pela programação vêm com ela). */
    @IsBoolean()
    sessions: boolean;

    /** Grupos, atividades e a programação de cada dia. */
    @IsBoolean()
    schedule: boolean;

    /** Módulos, aulas, vídeos e materiais de apoio. */
    @IsBoolean()
    lessons: boolean;
}
