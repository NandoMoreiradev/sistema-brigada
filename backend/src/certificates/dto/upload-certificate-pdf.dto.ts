import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class UploadCertificatePdfDto {
    /** Chave devolvida por `POST /media/presigned-url` (contexto `certificates`). */
    @IsString()
    @IsNotEmpty()
    @MaxLength(300)
    storageKey: string;
}
