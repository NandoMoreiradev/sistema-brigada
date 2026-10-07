import { IsIn, IsNotEmpty, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateCertificateDesignDto {
    @IsString()
    @IsNotEmpty({ message: 'Dê um nome ao modelo.' })
    @MaxLength(80)
    name: string;

    /** Começar de um modelo pronto (padrão: Clássico) */
    @IsIn(['classic', 'modern', 'elegant'])
    @IsOptional()
    presetId?: string;

    /** Começar de uma cópia de outro modelo da academia */
    @IsString()
    @IsOptional()
    duplicateFromId?: string;

    /** Layout completo (validado no service) */
    @IsObject()
    @IsOptional()
    layout?: Record<string, unknown>;
}

export class UpdateCertificateDesignDto {
    @IsString()
    @IsNotEmpty({ message: 'Dê um nome ao modelo.' })
    @MaxLength(80)
    @IsOptional()
    name?: string;

    /** Layout completo (validado no service) */
    @IsObject()
    @IsOptional()
    layout?: Record<string, unknown>;
}
