// backend/src/communications/communications.module.ts

import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { EmailSenderFactory } from './providers/email-sender.factory';
import { MailService } from './mail.service';
import { EmailRendererService } from './email-renderer.service';
import { MergeTagService } from '../common/merge-tag.service';

@Module({
    imports: [PrismaModule],
    providers: [EmailSenderFactory, MailService, EmailRendererService, MergeTagService],
    exports: [MailService, EmailRendererService, MergeTagService],
})
export class CommunicationsModule {}
