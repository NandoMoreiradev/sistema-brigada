// backend/src/communications/mail.service.ts
//
// Adaptado de maskotCrmEdu/backend/src/communications/mail.service.ts, bem mais simples:
// sem cota mensal de envio, sem bloqueio por bounce/pendência financeira, sem perfil de
// remetente por módulo, sem domínio verificado in-app — tudo isso é infraestrutura de
// CRM/billing que este produto não tem (ver comentário no topo de schema.prisma, seção
// E-MAIL TRANSACIONAL). `organizationId: null` força o remetente/conta da plataforma —
// é assim que TransactionalEmailService.PLATFORM_TRIGGERS garante que boas-vindas e reset
// de senha nunca saem pela conta Resend de uma academia, mesmo que ela tenha uma própria.

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { EmailSenderFactory } from './providers/email-sender.factory';

export interface SendSingleEmailOptions {
    organizationId: string | null;
    to: string;
    /** Sobrescreve a resolução automática de remetente. */
    from?: string;
    subject: string;
    html: string;
    replyTo?: string;
}

@Injectable()
export class MailService {
    private readonly logger = new Logger(MailService.name);
    private readonly platformDefaultSender: string;

    constructor(
        private readonly prisma: PrismaService,
        private readonly emailSenderFactory: EmailSenderFactory,
        private readonly configService: ConfigService,
    ) {
        this.platformDefaultSender =
            this.configService.get<string>('DEFAULT_FROM_EMAIL') ?? 'Brigada <no-reply@example.com>';
    }

    /**
     * Silenciosa de propósito: usada pelos gatilhos transacionais (boas-vindas,
     * reset de senha, certificado vencendo), que nunca podem derrubar o fluxo
     * que os disparou por causa de uma falha de envio. Para caminhos onde o
     * usuário PRECISA saber se falhou (ex.: "enviar e-mail de teste"), use
     * `sendSingleOrThrow`.
     */
    async sendSingle(options: SendSingleEmailOptions): Promise<void> {
        try {
            await this.sendSingleOrThrow(options);
        } catch (error) {
            this.logger.error(`Falha ao enviar e-mail para ${options.to}: ${(error as Error).message}`);
        }
    }

    async sendSingleOrThrow(options: SendSingleEmailOptions): Promise<void> {
        const { organizationId, to, subject, html, replyTo } = options;
        const finalFrom = options.from ?? (await this.resolveFrom(organizationId));

        const { sender, isOrganizationOwned } = await this.emailSenderFactory.forOrganization(organizationId);
        this.logger.log(
            `[MailService] Enviando para ${to} via ${finalFrom} (conta: ${isOrganizationOwned ? 'academia' : 'plataforma'})`,
        );
        await sender.sendSingle({ from: finalFrom, to, subject, html, replyTo });
    }

    private async resolveFrom(organizationId: string | null): Promise<string> {
        if (organizationId) {
            const organization = await this.prisma.organization.findUnique({
                where: { id: organizationId },
                select: { emailFromAddress: true, emailFromName: true, name: true },
            });

            if (organization?.emailFromAddress) {
                return `${organization.emailFromName || organization.name} <${organization.emailFromAddress}>`;
            }
        }

        return this.platformDefaultSender;
    }
}
