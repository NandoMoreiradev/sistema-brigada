// backend/src/common/email.service.ts
//
// Wrapper mínimo sobre o Resend, usado hoje só pelo fluxo de "esqueci minha
// senha" do AuthService. O maskotCrmEdu tem um sistema completo de templates
// de e-mail (email-templates/, communications/mail.service.ts,
// email-renderer.service.ts, merge-tag.service.ts) que não existe destino para
// neste schema — não foi portado. Se o produto precisar de e-mails
// transacionais mais elaborados (boas-vindas, alerta de vencimento de
// certificado), esse é o lugar natural para crescer, ou reavaliar portar o
// sistema de templates do projeto-fonte.

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

@Injectable()
export class EmailService {
    private readonly logger = new Logger(EmailService.name);
    private readonly resend: Resend | null;
    private readonly defaultSender: string;

    constructor(private readonly configService: ConfigService) {
        const apiKey = this.configService.get<string>('RESEND_API_KEY');
        this.resend = apiKey ? new Resend(apiKey) : null;
        this.defaultSender =
            this.configService.get<string>('DEFAULT_FROM_EMAIL') ?? 'Brigada <no-reply@example.com>';

        if (!this.resend) {
            this.logger.warn('RESEND_API_KEY não configurada — e-mails serão apenas logados, não enviados.');
        }
    }

    async send(to: string, subject: string, html: string): Promise<void> {
        if (!this.resend) {
            this.logger.log(`[EmailService] (modo log, sem RESEND_API_KEY) Para: ${to} | Assunto: ${subject}`);
            return;
        }

        try {
            await this.resend.emails.send({
                from: this.defaultSender,
                to,
                subject,
                html,
            });
        } catch (error) {
            this.logger.error(`Falha ao enviar e-mail para ${to}: ${(error as Error).message}`);
        }
    }

    async sendPasswordResetEmail(to: string, name: string, resetLink: string): Promise<void> {
        const firstName = name.split(' ')[0];
        const html = `
            <p>Olá, ${firstName}.</p>
            <p>Recebemos uma solicitação para redefinir sua senha.</p>
            <p><a href="${resetLink}">Clique aqui para definir uma nova senha</a></p>
            <p>Se você não solicitou isso, pode ignorar este e-mail.</p>
        `;
        await this.send(to, 'Redefinição de senha', html);
    }
}
