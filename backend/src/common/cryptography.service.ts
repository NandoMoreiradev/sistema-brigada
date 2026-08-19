// backend/src/common/cryptography.service.ts
// Copiado quase 1:1 de maskotCrmEdu/backend/src/utils/cryptography.service.ts.
// Usado hoje só pelo TwoFactorAuthService para criptografar o secret do TOTP.

import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class CryptographyService {
    private readonly logger = new Logger(CryptographyService.name);
    private readonly algorithm = 'aes-256-gcm';
    private readonly key: Buffer;
    private readonly ivLength = 16;

    constructor(private readonly configService: ConfigService) {
        const secretKey = this.configService.get<string>('CRYPTO_SECRET_KEY');
        if (!secretKey) {
            throw new Error('CRYPTO_SECRET_KEY não está definida no .env');
        }
        this.key = Buffer.from(secretKey, 'base64');
        if (this.key.length !== 32) {
            throw new Error('CRYPTO_SECRET_KEY deve ser uma string base64 de 32 bytes.');
        }
    }

    encrypt(text: string): string {
        try {
            const iv = crypto.randomBytes(this.ivLength);
            const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);
            const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
            const authTag = cipher.getAuthTag();
            return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
        } catch (error) {
            this.logger.error('Falha ao criptografar dados', error);
            throw new InternalServerErrorException('Não foi possível criptografar os dados.');
        }
    }

    decrypt(encryptedText: string): string {
        try {
            if (!encryptedText) {
                throw new Error('Texto criptografado fornecido é nulo ou vazio.');
            }
            const parts = encryptedText.split(':');
            if (parts.length !== 3) {
                throw new Error('Formato de texto criptografado inválido. Esperado "iv:authTag:encryptedData".');
            }
            const iv = Buffer.from(parts[0], 'hex');
            const authTag = Buffer.from(parts[1], 'hex');
            const encryptedData = Buffer.from(parts[2], 'hex');
            const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
            decipher.setAuthTag(authTag);
            const decrypted = Buffer.concat([decipher.update(encryptedData), decipher.final()]);
            return decrypted.toString('utf8');
        } catch (error) {
            this.logger.error('Falha ao descriptografar dados.', error);
            if (error instanceof Error && error.message.includes('Formato de texto criptografado inválido')) {
                throw new InternalServerErrorException(error.message);
            }
            throw new InternalServerErrorException(
                'Não foi possível descriptografar os dados. A chave pode estar incorreta ou os dados corrompidos.',
            );
        }
    }
}
