import { IsString, IsNotEmpty, IsBoolean, IsOptional } from 'class-validator';

export class IssueCertificateDto {
    @IsString()
    @IsNotEmpty()
    enrollmentId: string;

    /** Ignora os critérios de presença/aulas assistidas da turma — sobreposição administrativa explícita. */
    @IsBoolean()
    @IsOptional()
    force?: boolean;
}
