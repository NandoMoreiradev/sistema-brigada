import { ArrayMaxSize, ArrayUnique, IsArray, IsBoolean, IsEnum, IsInt, IsString, Max, Min } from 'class-validator';
import { CertificateReminderDigestFrequency } from '@prisma/client';

/** Configuração completa (PUT substitui tudo) — também é o corpo da pré-visualização. */
export class CertificateReminderSettingsDto {
    @IsBoolean()
    enabled: boolean;

    @IsArray()
    @ArrayMaxSize(6, { message: 'Use no máximo 6 lembretes antes do vencimento.' })
    @ArrayUnique({ message: 'Há lembretes repetidos antes do vencimento.' })
    @IsInt({ each: true })
    @Min(0, { each: true })
    @Max(365, { each: true, message: 'Lembretes podem ser de até 365 dias antes.' })
    daysBefore: number[];

    @IsArray()
    @ArrayMaxSize(4, { message: 'Use no máximo 4 lembretes depois do vencimento.' })
    @ArrayUnique({ message: 'Há lembretes repetidos depois do vencimento.' })
    @IsInt({ each: true })
    @Min(1, { each: true, message: 'Lembretes depois do vencimento começam em 1 dia.' })
    @Max(365, { each: true })
    daysAfter: number[];

    @IsInt()
    @Min(0, { message: 'Horário de envio inválido.' })
    @Max(23, { message: 'Horário de envio inválido.' })
    sendHour: number;

    @IsBoolean()
    includeRecyclingSuggestion: boolean;

    @IsEnum(CertificateReminderDigestFrequency)
    digestFrequency: CertificateReminderDigestFrequency;

    @IsArray()
    @ArrayMaxSize(20)
    @IsString({ each: true })
    digestRecipientUserIds: string[];

    @IsInt()
    @Min(7, { message: 'O resumo deve cobrir de 7 a 180 dias.' })
    @Max(180, { message: 'O resumo deve cobrir de 7 a 180 dias.' })
    digestWindowDays: number;
}
