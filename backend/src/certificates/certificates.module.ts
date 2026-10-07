import { Module } from '@nestjs/common';
import { CertificatesService } from './certificates.service';
import { CertificatesController } from './certificates.controller';
import { CertificateTemplatesService } from './certificate-templates.service';
import { CertificateTemplatesController } from './certificate-templates.controller';
import { CertificatePdfService } from './certificate-pdf.service';
import { CertificateExpirationScheduler } from './certificate-expiration.scheduler';
import { CertificateRemindersService } from './certificate-reminders.service';
import { CertificateRemindersController } from './certificate-reminders.controller';
import { CertificateDesignsService } from './certificate-designs.service';
import { CertificateDesignsController } from './certificate-designs.controller';
import { PublicBadgeController } from './public-badge.controller';
import { PublicCertificateVerificationController } from './public-certificate-verification.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { MediaModule } from '../media/media.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { TransactionalEmailModule } from '../transactional-email/transactional-email.module';
import { ThrottlerModule } from '@nestjs/throttler';

@Module({
    imports: [
        PrismaModule,
        MediaModule,
        NotificationsModule,
        TransactionalEmailModule,
        // Escopo local, igual auth.module.ts — não há ThrottlerGuard global neste projeto.
        ThrottlerModule.forRoot([{ ttl: 60000, limit: 20 }]),
    ],
    controllers: [
        CertificatesController,
        CertificateTemplatesController,
        CertificateRemindersController,
        CertificateDesignsController,
        PublicBadgeController,
        PublicCertificateVerificationController,
    ],
    providers: [
        CertificatesService,
        CertificateTemplatesService,
        CertificatePdfService,
        CertificateRemindersService,
        CertificateDesignsService,
        CertificateExpirationScheduler,
    ],
    exports: [CertificatesService, CertificateDesignsService],
})
export class CertificatesModule {}
