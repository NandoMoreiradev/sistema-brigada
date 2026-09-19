// backend/src/media/dto/generate-presigned-url.dto.ts
//
// Adaptado de maskotCrmEdu/backend/src/media/dto/generate-presigned-url.dto.ts.
// Contextos trocados pelos deste produto (logo/assinatura de certificado,
// vídeo-aula, comprovante de certificação externa, arquivo de evento, avatar).

import { IsNotEmpty, IsString, IsIn, IsNumber, Min } from 'class-validator';

const allowedContexts = [
    // Organization.logoUrl / CertificateTemplate.logoUrl e signatureImageUrl
    'organization-branding',
    // CourseLesson.videoUrl / videoKey (vídeo-aulas)
    'course-lessons',
    // Certificate.pdfKey
    'certificates',
    // ExternalCertification.proofFileKey
    'external-certifications',
    // EventFile.storageKey (pauta, ata, comprovantes de evento)
    'event-files',
    // EventOperation.floorPlanKey (planta baixa do local, pra plotar EventPost)
    'event-floor-plan',
    // User.avatarUrl
    'avatars',
    // Imagens inseridas no construtor visual de templates de e-mail (bloco "Imagem")
    'email-templates',
] as const;

export type UploadContext = (typeof allowedContexts)[number];

export class GeneratePresignedUrlDto {
    @IsString()
    @IsNotEmpty()
    fileName: string;

    @IsString()
    @IsNotEmpty()
    contentType: string;

    @IsString()
    @IsNotEmpty()
    @IsIn(allowedContexts, {
        message: 'Contexto de upload inválido. Contextos permitidos: ' + allowedContexts.join(', '),
    })
    context: UploadContext;

    @IsNumber()
    @Min(0)
    fileSize: number;
}
