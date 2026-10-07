import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateLessonProgressDto {
    @IsBoolean()
    @IsOptional()
    completed?: boolean;

    /** Vídeo enviado que terminou de tocar: registra e conclui a aula se era o último que faltava. */
    @IsString()
    @IsOptional()
    watchedVideoId?: string;
}
