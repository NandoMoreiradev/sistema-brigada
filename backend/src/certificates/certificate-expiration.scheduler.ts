// backend/src/certificates/certificate-expiration.scheduler.ts
//
// Job diário que dispara o alerta de vencimento de certificado (decisão 19 do
// docs/decisoes.md). Usa `@nestjs/schedule` (cron in-process, registrado em
// `ScheduleModule.forRoot()` no AppModule) em vez de BullMQ — não exige Redis
// configurado só para rodar 1x por dia.

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CertificatesService } from './certificates.service';

@Injectable()
export class CertificateExpirationScheduler {
    private readonly logger = new Logger(CertificateExpirationScheduler.name);

    constructor(private readonly certificatesService: CertificatesService) {}

    @Cron(CronExpression.EVERY_DAY_AT_8AM)
    async handleExpiringCertificates() {
        try {
            const count = await this.certificatesService.notifyExpiringCertificates();
            if (count > 0) {
                this.logger.log(`Notificados ${count} certificado(s) vencendo nos próximos 30 dias.`);
            }
        } catch (error) {
            this.logger.error(`Falha ao verificar certificados vencendo: ${error.message}`, error.stack);
        }
    }
}
