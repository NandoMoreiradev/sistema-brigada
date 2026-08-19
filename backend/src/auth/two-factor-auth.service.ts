// backend/src/auth/two-factor-auth.service.ts
// Copiado quase 1:1 de maskotCrmEdu/backend/src/auth/two-factor-auth.service.ts.

import { Injectable, Logger } from '@nestjs/common';
import { authenticator } from 'otplib';
import * as qrcode from 'qrcode';
import * as crypto from 'crypto';
import { CryptographyService } from '../common/cryptography.service';
import { ConfigService } from '@nestjs/config';

/** Quantos códigos de recuperação são gerados ao ativar o 2FA. */
export const RECOVERY_CODES_COUNT = 10;

@Injectable()
export class TwoFactorAuthService {
    private readonly logger = new Logger(TwoFactorAuthService.name);
    private readonly serviceName: string;

    constructor(
        private readonly cryptographyService: CryptographyService,
        private readonly configService: ConfigService,
    ) {
        this.serviceName = this.configService.get<string>('TWO_FACTOR_SERVICE_NAME', 'Brigada');

        // window = 2 aceita códigos de até 2 intervalos antes/depois (±60s).
        authenticator.options = {
            window: 2,
        };
    }

    async generateSecret(userEmail: string) {
        const secret = authenticator.generateSecret();
        const otpauthUrl = authenticator.keyuri(userEmail, this.serviceName, secret);
        const encryptedSecret = this.cryptographyService.encrypt(secret);

        return { encryptedSecret, otpauthUrl };
    }

    async generateQrCodeDataURL(otpauthUrl: string): Promise<string> {
        try {
            return await qrcode.toDataURL(otpauthUrl);
        } catch (error) {
            this.logger.error('Failed to generate QR Code Data URL', error);
            throw new Error('Could not generate QR code.');
        }
    }

    // ─── Códigos de recuperação ──────────────────────────────────────────────

    generateRecoveryCodes(count = RECOVERY_CODES_COUNT): {
        plainCodes: string[];
        hashedCodes: string[];
    } {
        const plainCodes: string[] = [];

        for (let i = 0; i < count; i++) {
            const hex = crypto.randomBytes(6).toString('hex'); // 12 chars
            plainCodes.push(`${hex.slice(0, 4)}-${hex.slice(4, 8)}-${hex.slice(8, 12)}`);
        }

        return {
            plainCodes,
            hashedCodes: plainCodes.map((code) => this.hashRecoveryCode(code)),
        };
    }

    hashRecoveryCode(code: string): string {
        const normalized = code.replace(/[\s-]/g, '').toLowerCase();
        return crypto.createHash('sha256').update(normalized).digest('hex');
    }

    findMatchingRecoveryCode(code: string, hashedCodes: string[]): number {
        const candidate = Buffer.from(this.hashRecoveryCode(code), 'hex');

        let matchIndex = -1;
        for (let i = 0; i < hashedCodes.length; i++) {
            const stored = Buffer.from(hashedCodes[i], 'hex');
            if (stored.length === candidate.length && crypto.timingSafeEqual(stored, candidate)) {
                matchIndex = i;
            }
        }

        return matchIndex;
    }

    isTokenValid(token: string, encryptedSecret: string): boolean {
        if (!encryptedSecret) {
            this.logger.warn('2FA: Segredo criptografado não fornecido.');
            return false;
        }

        const cleanToken = token.replace(/\s+/g, '');

        if (!/^\d{6}$/.test(cleanToken)) {
            this.logger.warn(`2FA: Token inválido (formato incorreto): ${cleanToken}`);
            return false;
        }

        const secret = this.cryptographyService.decrypt(encryptedSecret);

        if (!secret) {
            this.logger.warn('Falha ao descriptografar o segredo 2FA para validação do token.');
            return false;
        }

        try {
            const isVerified = authenticator.verify({
                token: cleanToken,
                secret,
            });

            if (!isVerified) {
                this.logger.warn(`2FA: Token ${cleanToken} não verificado. Possível dessincronização de tempo.`);
            }

            return isVerified;
        } catch (error) {
            this.logger.error('2FA: Erro ao verificar token:', error);
            return false;
        }
    }
}
