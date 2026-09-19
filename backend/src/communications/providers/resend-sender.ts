// backend/src/communications/providers/resend-sender.ts
//
// Adaptado de maskotCrmEdu/backend/src/communications/providers/resend-sender.ts,
// sem `sendBatch` (ver imail-sender.interface.ts).

import { Logger } from '@nestjs/common';
import { Resend } from 'resend';
import { IMailSender, SingleSendOptions } from './imail-sender.interface';

/**
 * Implementação de IMailSender usando o SDK do Resend. Não é um `@Injectable`
 * — é instanciada pela EmailSenderFactory com a chave certa (a da academia ou
 * a global da plataforma).
 */
export class ResendSender implements IMailSender {
    readonly providerName = 'resend';
    private readonly logger = new Logger(ResendSender.name);

    constructor(private readonly client: Resend) {}

    async sendSingle(options: SingleSendOptions): Promise<{ providerMessageId: string }> {
        const { from, to, subject, html, replyTo } = options;

        const { data, error } = await this.client.emails.send({
            from,
            to: [to],
            subject,
            html,
            ...(replyTo && { reply_to: replyTo }),
        });

        if (error) {
            this.logger.error(`[Resend] Falha ao enviar para ${to}: ${error.message}`);
            throw new Error(`Resend API Error: ${error.message}`);
        }

        return { providerMessageId: data!.id };
    }
}
