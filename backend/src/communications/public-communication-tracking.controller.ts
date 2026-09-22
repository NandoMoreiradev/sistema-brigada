// backend/src/communications/public-communication-tracking.controller.ts
//
// Endpoint público (sem auth — quem "chama" é o próprio cliente de e-mail de quem recebeu o
// comunicado, carregando a tag <img> embutida no HTML, ver
// CommunicationBroadcastService.appendTrackingPixel) que registra a abertura e devolve um gif
// transparente 1x1. Sem @UseGuards neste controller, então já é público por natureza (o guard
// não é global neste projeto, mesmo padrão de PublicBadgeController) — @Public() fica só como
// documentação.

import { Controller, Get, Header, Param, StreamableFile } from '@nestjs/common';
import { CommunicationBroadcastService } from './communication-broadcast.service';
import { Public } from '../auth/decorator/public.decorator';

// Gif transparente 1x1 padrão, usado por praticamente todo tracking pixel de e-mail.
const TRANSPARENT_GIF = Buffer.from('R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==', 'base64');

@Controller('public/communications')
export class PublicCommunicationTrackingController {
    constructor(private readonly communicationsService: CommunicationBroadcastService) {}

    @Public()
    @Get('recipients/:id/open.gif')
    @Header('Content-Type', 'image/gif')
    @Header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    async trackOpen(@Param('id') id: string): Promise<StreamableFile> {
        await this.communicationsService.trackOpen(id);
        return new StreamableFile(TRANSPARENT_GIF);
    }
}
