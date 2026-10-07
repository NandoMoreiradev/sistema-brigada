import { IsOptional, IsString } from 'class-validator';

/** Sem nada = todos os certificados (não revogados) da academia. */
export class RegeneratePdfsDto {
    /** Só os desta turma */
    @IsString()
    @IsOptional()
    courseId?: string;

    /** Só os que usam este modelo de certificado */
    @IsString()
    @IsOptional()
    designId?: string;
}
