import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class RejectRegistrationDto {
    @IsOptional()
    @IsString()
    reason?: string;

    /** Avisar a pessoa por e-mail (com o motivo, se houver). Padrão: sim. */
    @IsOptional()
    @IsBoolean()
    notify?: boolean;
}
