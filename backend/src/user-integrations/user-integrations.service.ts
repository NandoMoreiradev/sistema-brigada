// backend/src/user-integrations/user-integrations.service.ts
//
// Adaptado de maskotCrmEdu/backend/src/user-integrations/user-integrations.service.ts.
//
// O model `UserIntegration` deste schema é mais simples que o original do
// maskotCrmEdu: não tem `isActive` (a existência do registro já significa
// "conectado" — desconectar apaga a linha em vez de marcar inativa), nem
// `accountId`/`accountName`, nem o enum `MarketingProvider` (aqui `provider`
// é string livre, ver comentário no schema). Por isso `getGoogleIntegrationStatus`
// devolve só `{ connected }` — sem o e-mail da conta Google conectada, que só
// existiria se chamássemos a API de userinfo de novo no callback (não fizemos
// por não termos onde persistir esse dado).

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { google } from 'googleapis';
import { GOOGLE_CALENDAR_PROVIDER } from './google-calendar/google-calendar.service';

@Injectable()
export class UserIntegrationsService {
    private readonly logger = new Logger(UserIntegrationsService.name);

    constructor(private readonly prisma: PrismaService) {}

    private getOAuth2Client() {
        return new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            process.env.GOOGLE_REDIRECT_URI,
        );
    }

    async getGoogleAuthUrl(userId: string): Promise<string> {
        const oauth2Client = this.getOAuth2Client();
        const scopes = ['https://www.googleapis.com/auth/userinfo.email', 'https://www.googleapis.com/auth/calendar.events'];

        return oauth2Client.generateAuthUrl({
            access_type: 'offline',
            prompt: 'consent', // Força exibir a tela para garantir o refresh_token.
            scope: scopes,
            state: userId, // Passa o userId no state para recuperar no callback.
        });
    }

    async getGoogleIntegrationStatus(userId: string): Promise<{ connected: boolean }> {
        const integration = await this.prisma.userIntegration.findUnique({
            where: { userId_provider: { userId, provider: GOOGLE_CALENDAR_PROVIDER } },
        });

        return { connected: !!integration };
    }

    async disconnectGoogle(userId: string): Promise<void> {
        await this.prisma.userIntegration.deleteMany({
            where: { userId, provider: GOOGLE_CALENDAR_PROVIDER },
        });
    }

    async handleGoogleCallback(userId: string, code: string): Promise<void> {
        const oauth2Client = this.getOAuth2Client();

        try {
            const { tokens } = await oauth2Client.getToken(code);

            if (!tokens.access_token) {
                throw new Error('O Google não retornou um access_token.');
            }

            await this.prisma.userIntegration.upsert({
                where: { userId_provider: { userId, provider: GOOGLE_CALENDAR_PROVIDER } },
                update: {
                    accessToken: tokens.access_token,
                    // Atualiza o refresh token apenas se o Google enviou um novo.
                    ...(tokens.refresh_token && { refreshToken: tokens.refresh_token }),
                    tokenExpiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
                },
                create: {
                    userId,
                    provider: GOOGLE_CALENDAR_PROVIDER,
                    accessToken: tokens.access_token,
                    refreshToken: tokens.refresh_token || null,
                    tokenExpiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
                },
            });

            this.logger.log(`Integração do Google Calendar concluída para o usuário ${userId}`);
        } catch (error) {
            this.logger.error(`Erro ao processar callback do Google para o usuário ${userId}: ${error.message}`);
            throw error;
        }
    }
}
