// backend/src/email-templates/email-templates.module.ts

import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CommunicationsModule } from '../communications/communications.module';
import { EmailTemplatesService } from './email-templates.service';
import { EmailTemplatesController } from './email-templates.controller';

@Module({
    imports: [PrismaModule, CommunicationsModule],
    controllers: [EmailTemplatesController],
    providers: [EmailTemplatesService],
    exports: [EmailTemplatesService],
})
export class EmailTemplatesModule {}
