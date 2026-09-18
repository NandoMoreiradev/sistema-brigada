import { Module } from '@nestjs/common';
import { CertificatesService } from './certificates.service';
import { CertificatesController } from './certificates.controller';
import { CertificateTemplatesService } from './certificate-templates.service';
import { CertificateTemplatesController } from './certificate-templates.controller';
import { CertificatePdfService } from './certificate-pdf.service';
import { CertificateExpirationScheduler } from './certificate-expiration.scheduler';
import { PublicBadgeController } from './public-badge.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { MediaModule } from '../media/media.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { EmailService } from '../common/email.service';

@Module({
    imports: [PrismaModule, MediaModule, NotificationsModule],
    controllers: [CertificatesController, CertificateTemplatesController, PublicBadgeController],
    providers: [CertificatesService, CertificateTemplatesService, CertificatePdfService, CertificateExpirationScheduler, EmailService],
    exports: [CertificatesService],
})
export class CertificatesModule {}
