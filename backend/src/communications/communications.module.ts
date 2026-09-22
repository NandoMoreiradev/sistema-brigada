// backend/src/communications/communications.module.ts
//
// Além dos providers de infra de envio (usados por email-templates/transactional-email),
// este módulo agora também expõe o recurso "Comunicado" (e-mail avulso, ver
// communication-broadcast.service.ts) — é o dono natural porque já sabe montar e mandar e-mail.

import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { EmailSenderFactory } from './providers/email-sender.factory';
import { MailService } from './mail.service';
import { EmailRendererService } from './email-renderer.service';
import { MergeTagService } from '../common/merge-tag.service';
import { CommunicationBroadcastService } from './communication-broadcast.service';
import { CommunicationsController } from './communications.controller';
import { PublicCommunicationTrackingController } from './public-communication-tracking.controller';

@Module({
    imports: [PrismaModule],
    controllers: [CommunicationsController, PublicCommunicationTrackingController],
    providers: [EmailSenderFactory, MailService, EmailRendererService, MergeTagService, CommunicationBroadcastService],
    exports: [MailService, EmailRendererService, MergeTagService],
})
export class CommunicationsModule {}
