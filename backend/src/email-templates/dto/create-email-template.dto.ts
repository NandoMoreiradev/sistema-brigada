// backend/src/email-templates/dto/create-email-template.dto.ts

import { EmailTriggerType, Prisma } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateEmailTemplateDto {
    @IsString()
    @IsNotEmpty()
    @MaxLength(100, { message: 'O nome do template não pode exceder 100 caracteres.' })
    name: string;

    @IsString()
    @IsNotEmpty()
    @MaxLength(255, { message: 'O assunto do e-mail não pode exceder 255 caracteres.' })
    subject: string;

    @IsOptional()
    @IsString()
    @MaxLength(100000, { message: 'O corpo do e-mail não pode exceder 100.000 caracteres.' })
    body?: string;

    @IsOptional()
    @IsObject({ message: 'O designJson deve ser um objeto JSON válido.' })
    designJson?: Prisma.JsonValue;

    @IsOptional()
    @IsEnum(EmailTriggerType, { message: 'Gatilho inválido.' })
    trigger?: EmailTriggerType | null;

    /** Só SUPER_ADMIN pode definir — ausente/null = template padrão global. */
    @IsOptional()
    @IsString()
    organizationId?: string;
}
