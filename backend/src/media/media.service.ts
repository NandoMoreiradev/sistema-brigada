// backend/src/media/media.service.ts
//
// Copiado quase 1:1 de maskotCrmEdu/backend/src/media/media.service.ts (padrão
// de upload R2 com PutObjectCommand + getSignedUrl). Mesmos nomes de env var
// (R2_*) do original. REMOVIDO: `validateStorageLimit` (dependia de
// School.totalStorageUsedBytes + billingAccount.subscriptions.plan — não há
// módulo financeiro nem cota de storage neste projeto, decisão 4 do plano de
// produto) e a checagem de limite específica do WhatsApp (não existe aqui).

import * as https from 'https';
import {
    Injectable,
    Logger,
    InternalServerErrorException,
    BadRequestException,
    ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { NodeHttpHandler } from '@aws-sdk/node-http-handler';
import { v4 as uuidv4 } from 'uuid';
import { GeneratePresignedUrlDto, UploadContext } from './dto/generate-presigned-url.dto';

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];
const VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-matroska'];
const DOCUMENT_TYPES = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

const allowedMimeTypes: Record<UploadContext, string[]> = {
    'organization-branding': IMAGE_TYPES,
    'course-lessons': [...VIDEO_TYPES, ...IMAGE_TYPES],
    certificates: ['application/pdf'],
    'external-certifications': [...DOCUMENT_TYPES, ...IMAGE_TYPES],
    'event-files': [...DOCUMENT_TYPES, ...IMAGE_TYPES],
    avatars: IMAGE_TYPES,
};

@Injectable()
export class MediaService {
    private readonly logger = new Logger(MediaService.name);
    private readonly s3Client?: S3Client;
    private readonly bucketName?: string;
    readonly publicUrl?: string;

    constructor(private readonly configService: ConfigService) {
        const accountId = this.configService.get<string>('R2_ACCOUNT_ID');
        const bucketName = this.configService.get<string>('R2_BUCKET_NAME');
        const publicUrl = this.configService.get<string>('R2_PUBLIC_URL');
        const accessKeyId = this.configService.get<string>('R2_ACCESS_KEY_ID');
        const secretAccessKey = this.configService.get<string>('R2_SECRET_ACCESS_KEY');

        if (!accountId || !bucketName || !publicUrl || !accessKeyId || !secretAccessKey) {
            this.logger.warn(
                'Variáveis R2_* ausentes — MediaService desativado (upload de mídia vai falhar até serem configuradas).',
            );
            return;
        }

        this.bucketName = bucketName;
        this.publicUrl = publicUrl;
        const endpoint = `https://${accountId}.r2.cloudflarestorage.com`;

        const httpsAgent = new https.Agent({ minVersion: 'TLSv1.2', keepAlive: true });
        const requestHandler = new NodeHttpHandler({ httpsAgent });

        this.s3Client = new S3Client({
            region: 'auto',
            endpoint,
            credentials: { accessKeyId, secretAccessKey },
            requestHandler,
            forcePathStyle: true,
            requestChecksumCalculation: 'WHEN_REQUIRED',
            responseChecksumValidation: 'WHEN_REQUIRED',
        });
        this.logger.log('MediaService inicializado e conectado ao Cloudflare R2.');
    }

    private getClient(): S3Client {
        if (!this.s3Client) {
            throw new ServiceUnavailableException(
                'Upload de mídia não está configurado neste ambiente (variáveis R2_* ausentes).',
            );
        }
        return this.s3Client;
    }

    async uploadFileFromBuffer(
        buffer: Buffer,
        originalname: string,
        mimetype: string,
        folder: string,
    ): Promise<{ url: string; key: string }> {
        const fileExtension = originalname.split('.').pop() || 'bin';
        const uniqueFileName = `${uuidv4()}.${fileExtension}`;
        const key = `${folder}/${uniqueFileName}`;

        const command = new PutObjectCommand({
            Bucket: this.bucketName,
            Key: key,
            Body: buffer,
            ContentType: mimetype,
            ContentDisposition: 'inline',
            CacheControl: 'public, max-age=31536000',
        });

        try {
            await this.getClient().send(command);
            const url = `${this.publicUrl}/${key}`;
            return { url, key };
        } catch (error) {
            this.logger.error(`Falha no upload do buffer para o R2: ${error.message}`, error.stack);
            throw new InternalServerErrorException('Não foi possível fazer o upload do arquivo.');
        }
    }

    /**
     * Gera uma presigned URL para upload direto do browser. Apenas ContentType
     * é incluído no comando: é o único header que o browser envia de forma
     * confiável no PUT.
     */
    async generatePresignedUrl(
        dto: GeneratePresignedUrlDto,
        organizationId: string | null,
    ): Promise<{ signedUrl: string; fileUrl: string; storageKey: string }> {
        const { fileName, contentType, context } = dto;

        const allowedTypesForContext = allowedMimeTypes[context];
        if (allowedTypesForContext && allowedTypesForContext.length > 0 && !allowedTypesForContext.includes(contentType)) {
            throw new BadRequestException(`Tipo de arquivo '${contentType}' não é permitido para o contexto '${context}'.`);
        }

        const fileExtension = fileName.split('.').pop() || 'bin';
        const uniqueKey = `${uuidv4()}.${fileExtension}`;
        const folderPath = organizationId ? `${context}/${organizationId}` : `system/global/${context}`;
        const key = `${folderPath}/${uniqueKey}`;

        this.logger.log(`Gerando Presigned URL para: ${key} (Type: ${contentType})`);

        const command = new PutObjectCommand({
            Bucket: this.bucketName,
            Key: key,
            ContentType: contentType,
        });

        try {
            const signedUrl = await getSignedUrl(this.getClient(), command, {
                expiresIn: 300,
                signableHeaders: new Set(['content-type']),
            });
            const fileUrl = `${this.publicUrl}/${key}`;

            return { signedUrl, fileUrl, storageKey: key };
        } catch (error) {
            this.logger.error(`Falha ao gerar a Presigned URL: ${error.message}`, error.stack);
            throw new InternalServerErrorException('Não foi possível gerar a URL para upload.');
        }
    }

    async generatePresignedDownloadUrl(key: string): Promise<string> {
        const command = new GetObjectCommand({ Bucket: this.bucketName, Key: key });
        try {
            return await getSignedUrl(this.getClient(), command, { expiresIn: 300 });
        } catch (error) {
            this.logger.error(`Falha ao gerar URL de download: ${error.message}`);
            throw new InternalServerErrorException('Erro ao gerar link de download.');
        }
    }

    async getObjectStream(key: string): Promise<NodeJS.ReadableStream> {
        const command = new GetObjectCommand({ Bucket: this.bucketName, Key: key });
        const response = await this.getClient().send(command);
        return response.Body as NodeJS.ReadableStream;
    }

    async overwriteObject(key: string, buffer: Buffer, contentType: string): Promise<void> {
        const command = new PutObjectCommand({
            Bucket: this.bucketName,
            Key: key,
            Body: buffer,
            ContentType: contentType,
            ContentDisposition: 'inline',
        });
        try {
            await this.getClient().send(command);
            this.logger.log(`Objeto ${key} sobrescrito com sucesso.`);
        } catch (error) {
            this.logger.error(`Falha ao sobrescrever objeto ${key}: ${error.message}`, error.stack);
            throw new InternalServerErrorException('Não foi possível salvar o arquivo.');
        }
    }

    async deleteObject(key: string): Promise<void> {
        const command = new DeleteObjectCommand({ Bucket: this.bucketName, Key: key });
        try {
            await this.getClient().send(command);
            this.logger.log(`Objeto ${key} excluído com sucesso.`);
        } catch (error) {
            this.logger.error(`Falha ao excluir objeto ${key}: ${error.message}`);
        }
    }
}
