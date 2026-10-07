// backend/src/certificates/certificate-expiration.scheduler.ts
//
// Job diário que dispara o alerta de vencimento de certificado (decisão 19 do
// docs/decisoes.md). Usa `@nestjs/schedule` (cron in-process, registrado em
// `ScheduleModule.forRoot()` no AppModule) em vez de BullMQ — não exige Redis
// configurado só para rodar 1x por dia.
//
// `timeZone` explícito: sem ele o cron segue o relógio do servidor, que no
// Railway é UTC — o "8h" virava 5h da manhã no horário de Brasília.

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CertificatesService } from './certificates.service';
import { APP_TIME_ZONE } from '../common/datetime';

@Injectable()
export class CertificateExpirationScheduler {
    private readonly logger = new Logger(CertificateExpirationScheduler.name);

    constructor(private readonly certificatesService: CertificatesService) {}

    /** Logo depois da meia-noite: o certificado vira "Vencido" no dia seguinte ao último dia de validade. */
    @Cron('5 0 * * *', { timeZone: APP_TIME_ZONE })
    async handleExpiredCertificates() {
        try {
            const count = await this.certificatesService.markExpiredCertificates();
            if (count > 0) {
                this.logger.log(`${count} certificado(s) marcado(s) como vencido(s).`);
            }
        } catch (error) {
            this.logger.error(`Falha ao marcar certificados vencidos: ${error.message}`, error.stack);
        }
    }

    @Cron(CronExpression.EVERY_DAY_AT_8AM, { timeZone: APP_TIME_ZONE })
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
