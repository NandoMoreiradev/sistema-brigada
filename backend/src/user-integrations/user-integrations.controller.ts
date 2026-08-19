// backend/src/user-integrations/user-integrations.controller.ts
//
// Adaptado de maskotCrmEdu/backend/src/user-integrations/user-integrations.controller.ts.
// Único provedor suportado por enquanto é o Google Calendar. Adicionado
// `DELETE google` (desconectar) — o original não tinha, mas era pedido
// explícito desta tarefa e é o par natural de `google/status`.

import { Controller, Get, Delete, Res, UseGuards, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { UserIntegrationsService } from './user-integrations.service';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { CurrentUser } from '../auth/common/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';

@Controller('user-integrations')
export class UserIntegrationsController {
    constructor(private readonly userIntegrationsService: UserIntegrationsService) {}

    @UseGuards(JwtAuthGuard)
    @Get('google/auth')
    async getGoogleAuthUrl(@CurrentUser() user: AuthenticatedUser) {
        const url = await this.userIntegrationsService.getGoogleAuthUrl(user.id);
        return { url };
    }

    @UseGuards(JwtAuthGuard)
    @Get('google/status')
    async getGoogleIntegrationStatus(@CurrentUser() user: AuthenticatedUser) {
        return this.userIntegrationsService.getGoogleIntegrationStatus(user.id);
    }

    @UseGuards(JwtAuthGuard)
    @Delete('google')
    @HttpCode(HttpStatus.NO_CONTENT)
    async disconnectGoogle(@CurrentUser() user: AuthenticatedUser): Promise<void> {
        await this.userIntegrationsService.disconnectGoogle(user.id);
    }

    // Sem guard: é o Google redirecionando o navegador do usuário de volta
    // para cá, não uma chamada autenticada da nossa própria API. A identidade
    // do usuário vem do `state`, setado por nós em `getGoogleAuthUrl`.
    @Get('google/callback')
    async handleGoogleCallback(@Res() res: Response, @Query('code') code: string, @Query('state') state: string, @Query('error') error?: string) {
        const frontendUrl = process.env.FRONTEND_URL?.split(',')[0] || 'http://localhost:5173';

        if (error) {
            return res.redirect(`${frontendUrl}/calendar?error=google_auth_failed`);
        }

        try {
            // O state passado na URL de auth era o userId.
            const userId = state;
            await this.userIntegrationsService.handleGoogleCallback(userId, code);
            return res.redirect(`${frontendUrl}/calendar?success=google_auth_linked`);
        } catch (err) {
            console.error('Error handling Google Calendar callback:', err);
            return res.redirect(`${frontendUrl}/calendar?error=google_sync_error`);
        }
    }
}
