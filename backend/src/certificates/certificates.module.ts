import { Module } from '@nestjs/common';
import { CertificatesService } from './certificates.service';
import { CertificatesController } from './certificates.controller';
import { CertificateTemplatesService } from './certificate-templates.service';
import { CertificateTemplatesController } from './certificate-templates.controller';
import { CertificatePdfService } from './certificate-pdf.service';
import { PublicBadgeController } from './public-badge.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { MediaModule } from '../media/media.module';

@Module({
    imports: [PrismaModule, MediaModule],
    controllers: [CertificatesController, CertificateTemplatesController, PublicBadgeController],
    providers: [CertificatesService, CertificateTemplatesService, CertificatePdfService],
    exports: [CertificatesService],
})
export class CertificatesModule {}
