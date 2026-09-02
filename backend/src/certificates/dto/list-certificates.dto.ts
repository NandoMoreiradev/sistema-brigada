import { IsOptional, IsIn, IsInt, Min } from 'class-validator';
import { Transform } from 'class-transformer';
import { CertificateStatus } from '@prisma/client';

const CERTIFICATE_STATUS_VALUES = Object.values(CertificateStatus);

export class ListCertificatesDto {
    @IsOptional()
    @IsIn(CERTIFICATE_STATUS_VALUES)
    status?: CertificateStatus;

    /** Certificados que vencem nos próximos N dias (para o alerta de reciclagem, decisão 19). */
    @IsOptional()
    @IsInt()
    @Min(1)
    @Transform(({ value }) => (value === undefined ? undefined : parseInt(value, 10)))
    expiringInDays?: number;

    @IsOptional()
    @IsInt()
    @Min(1)
    @Transform(({ value }) => (value === undefined ? undefined : parseInt(value, 10)))
    page?: number = 1;

    @IsOptional()
    @IsInt()
    @Min(1)
    @Transform(({ value }) => (value === undefined ? undefined : parseInt(value, 10)))
    limit?: number = 20;
}
