// backend/src/user-integrations/google-calendar/google-calendar.service.ts
//
// Adaptado de maskotCrmEdu/backend/src/user-integrations/google-calendar/google-calendar.service.ts.
//
// Esta versão já foi copiada antes desacoplada da persistência (recebia os
// tokens OAuth como parâmetro), porque o schema não tinha onde guardar o
// token do Google por usuário. Agora que o model `UserIntegration` existe
// (schema.prisma, seção "INTEGRAÇÕES E NOTIFICAÇÕES"), o serviço volta a
// buscar e persistir o token sozinho, como no original: `createEvent`/
// `updateEvent`/`deleteEvent` recebem só o `userId`, buscam o
// `UserIntegration` (provider = GOOGLE_CALENDAR_PROVIDER) e reagem ao evento
// `tokens` do SDK do Google salvando o novo access/refresh token de volta no
// banco quando ele é renovado automaticamente.
//
// Mantido da versão desacoplada (não existia no original do maskotCrmEdu, é
// específico deste produto): criação de evento com Google Meet automático
// (`conferenceData` + `conferenceDataVersion: 1`) e a extração do
// `hangoutLink` da resposta, para o módulo de reuniões (`Meeting.meetUrl` no
// schema) preencher o link sem precisar reimplementar a chamada à API.

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { google } from 'googleapis';
import { v4 as uuidv4 } from 'uuid';

/** Valor de `UserIntegration.provider` usado para a integração do Google Calendar. */
export const GOOGLE_CALENDAR_PROVIDER = 'GOOGLE_CALENDAR';

export interface CalendarEventData {
    summary: string;
    description?: string;
    location?: string;
    start: Date;
    end: Date;
    attendees?: string[];
}

export interface CreatedCalendarEvent {
    /** ID do evento no Google Calendar. */
    eventId: string | null;
    /** Link do Google Meet gerado automaticamente para o evento (Meeting.meetUrl). */
    meetUrl: string | null;
}

@Injectable()
export class GoogleCalendarService {
    private readonly logger = new Logger(GoogleCalendarService.name);

    constructor(private readonly prisma: PrismaService) {}

    /**
     * Monta o client OAuth do Google a partir do token persistido do usuário e
     * liga o refresh automático de volta ao `UserIntegration` no banco.
     */
    private async getOAuthClient(userId: string) {
        const integration = await this.prisma.userIntegration.findUnique({
            where: { userId_provider: { userId, provider: GOOGLE_CALENDAR_PROVIDER } },
        });

        if (!integration) {
            throw new Error(`Integração do Google Calendar não encontrada para o usuário ${userId}`);
        }

        const oAuth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            process.env.GOOGLE_REDIRECT_URI,
        );

        oAuth2Client.setCredentials({
            access_token: integration.accessToken,
            refresh_token: integration.refreshToken ?? undefined,
            expiry_date: integration.tokenExpiresAt?.getTime(),
        });

        // Lida com o refresh do token automaticamente se expirado.
        oAuth2Client.on('tokens', (tokens) => {
            this.logger.log(`Renovando tokens do Google Calendar para o usuário ${userId}`);
            this.prisma.userIntegration
                .update({
                    where: { id: integration.id },
                    data: {
                        accessToken: tokens.access_token || integration.accessToken,
                        ...(tokens.refresh_token && { refreshToken: tokens.refresh_token }),
                        tokenExpiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : integration.tokenExpiresAt,
                    },
                })
                .catch((error) =>
                    this.logger.error(`Falha ao persistir tokens renovados do Google Calendar (usuário ${userId}): ${error.message}`),
                );
        });

        return oAuth2Client;
    }

    /**
     * Cria um evento no Google Calendar do usuário, com uma sala do Google
     * Meet gerada automaticamente (`conferenceData` + `conferenceDataVersion: 1`).
     */
    async createEvent(userId: string, eventData: CalendarEventData): Promise<CreatedCalendarEvent | null> {
        try {
            const auth = await this.getOAuthClient(userId);
            const calendar = google.calendar({ version: 'v3', auth });

            const event = {
                summary: eventData.summary,
                description: eventData.description,
                location: eventData.location,
                start: { dateTime: eventData.start.toISOString(), timeZone: 'America/Sao_Paulo' },
                end: { dateTime: eventData.end.toISOString(), timeZone: 'America/Sao_Paulo' },
                attendees: eventData.attendees?.map((email) => ({ email })),
                conferenceData: {
                    createRequest: {
                        requestId: uuidv4(),
                        conferenceSolutionKey: { type: 'hangoutsMeet' },
                    },
                },
            };

            const response = await calendar.events.insert({
                calendarId: 'primary',
                requestBody: event,
                conferenceDataVersion: 1,
            });

            const meetUrl = response.data.hangoutLink ?? null;
            this.logger.log(`Criado evento ${response.data.id} no Google Calendar do usuário ${userId} (meetUrl: ${meetUrl ?? 'n/d'})`);

            return { eventId: response.data.id ?? null, meetUrl };
        } catch (error) {
            this.logger.error(`Falha ao criar evento no Google Calendar do usuário ${userId}: ${error.message}`);
            // Não propaga o erro para não quebrar o fluxo principal se o Google falhar.
            return null;
        }
    }

    /**
     * Atualiza um evento existente no Google Calendar.
     */
    async updateEvent(userId: string, eventId: string, eventData: CalendarEventData): Promise<CreatedCalendarEvent | null> {
        try {
            const auth = await this.getOAuthClient(userId);
            const calendar = google.calendar({ version: 'v3', auth });

            const event = {
                summary: eventData.summary,
                description: eventData.description,
                location: eventData.location,
                start: { dateTime: eventData.start.toISOString(), timeZone: 'America/Sao_Paulo' },
                end: { dateTime: eventData.end.toISOString(), timeZone: 'America/Sao_Paulo' },
                attendees: eventData.attendees?.map((email) => ({ email })),
            };

            const response = await calendar.events.update({
                calendarId: 'primary',
                eventId,
                requestBody: event,
                conferenceDataVersion: 1,
            });

            this.logger.log(`Atualizado evento ${eventId} no Google Calendar do usuário ${userId}`);
            return { eventId: response.data.id ?? eventId, meetUrl: response.data.hangoutLink ?? null };
        } catch (error) {
            this.logger.error(`Falha ao atualizar evento ${eventId} no Google Calendar do usuário ${userId}: ${error.message}`);
            return null;
        }
    }

    /**
     * Remove um evento do Google Calendar.
     */
    async deleteEvent(userId: string, eventId: string): Promise<boolean> {
        try {
            const auth = await this.getOAuthClient(userId);
            const calendar = google.calendar({ version: 'v3', auth });

            await calendar.events.delete({ calendarId: 'primary', eventId });

            this.logger.log(`Removido evento ${eventId} do Google Calendar do usuário ${userId}`);
            return true;
        } catch (error) {
            this.logger.error(`Falha ao remover evento ${eventId} do Google Calendar do usuário ${userId}: ${error.message}`);
            return false;
        }
    }
}
