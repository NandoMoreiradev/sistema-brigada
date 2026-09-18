// backend/src/transactional-email/transactional-email.module.ts

import { Module } from '@nestjs/common';
import { CommunicationsModule } from '../communications/communications.module';
import { EmailTemplatesModule } from '../email-templates/email-templates.module';
import { TransactionalEmailService } from './transactional-email.service';

@Module({
    imports: [CommunicationsModule, EmailTemplatesModule],
    providers: [TransactionalEmailService],
    exports: [TransactionalEmailService],
})
export class TransactionalEmailModule {}
