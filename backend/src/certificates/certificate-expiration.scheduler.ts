// backend/src/certificates/certificate-expiration.scheduler.ts
//
// Jobs de vencimento de certificado (decisão 19 do docs/decisoes.md): marcar
// vencidos e disparar os lembretes. Usa `@nestjs/schedule` (cron in-process, registrado em
// `ScheduleModule.forRoot()` no AppModule) em vez de BullMQ — não exige Redis
// configurado só para rodar 1x por dia.
//
// `timeZone` explícito: sem ele o cron segue o relógio do servidor, que no
// Railway é UTC — o "8h" virava 5h da manhã no horário de Brasília.

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CertificatesService } from './certificates.service';
import { CertificateRemindersService } from './certificate-reminders.service';
import { APP_TIME_ZONE } from '../common/datetime';

@Injectable()
export class CertificateExpirationScheduler {
    private readonly logger = new Logger(CertificateExpirationScheduler.name);

    constructor(
        private readonly certificatesService: CertificatesService,
        private readonly certificateRemindersService: CertificateRemindersService,
    ) {}

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

    /** De hora em hora: cada academia escolhe o horário dos lembretes (CertificateReminderSettings.sendHour). */
    @Cron(CronExpression.EVERY_HOUR, { timeZone: APP_TIME_ZONE })
    async handleReminders() {
        try {
            const { sent, failed, skipped, digests } = await this.certificateRemindersService.runScheduled();
            if (sent + failed + skipped + digests > 0) {
                this.logger.log(`Lembretes de vencimento: ${sent} enviado(s), ${failed} com falha, ${skipped} pulado(s), ${digests} resumo(s).`);
            }
        } catch (error) {
            this.logger.error(`Falha nos lembretes de vencimento: ${error.message}`, error.stack);
        }
    }
}
