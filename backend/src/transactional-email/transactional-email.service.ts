// backend/src/transactional-email/transactional-email.service.ts
//
// Adaptado de maskotCrmEdu/backend/src/transactional-email/transactional-email.service.ts,
// trimado para os 3 gatilhos deste produto (sem CRM de lead/visita/onboarding, sem
// unsubscribe — todos transacionais, nenhum de campanha).

import { Injectable, Logger } from '@nestjs/common';
import { EmailTriggerType } from '@prisma/client';
import { EmailTemplatesService } from '../email-templates/email-templates.service';
import { MailService } from '../communications/mail.service';
import { EmailRendererService } from '../communications/email-renderer.service';
import { MergeTagService, MergeTagContext } from '../common/merge-tag.service';

@Injectable()
export class TransactionalEmailService {
    private readonly logger = new Logger(TransactionalEmailService.name);

    /**
     * Gatilhos enviados PELA plataforma para a academia (boas-vindas, redefinição de
     * senha) — sempre saem pela conta/remetente da plataforma, mesmo que a academia tenha
     * Resend próprio configurado (ver EmailSenderFactory/MailService). CERTIFICATE_EXPIRING
     * não entra aqui: é a academia notificando o próprio aluno dela.
     */
    private static readonly PLATFORM_TRIGGERS: ReadonlySet<EmailTriggerType> = new Set([
        EmailTriggerType.ORGANIZATION_ADMIN_WELCOME,
        EmailTriggerType.PASSWORD_RESET,
    ]);

    constructor(
        private readonly emailTemplatesService: EmailTemplatesService,
        private readonly mailService: MailService,
        private readonly emailRendererService: EmailRendererService,
        private readonly mergeTagService: MergeTagService,
    ) {}

    private async sendEmailByTrigger(
        recipientEmail: string,
        trigger: EmailTriggerType,
        variables: MergeTagContext,
        organizationId: string | null,
    ): Promise<void> {
        try {
            const template = await this.emailTemplatesService.findTemplateByTrigger(organizationId, trigger);

            if (!template) {
                this.logger.error(`Nenhum template de e-mail encontrado para o gatilho ${trigger} (academia: ${organizationId ?? 'global'}).`);
                return;
            }

            const finalSubject = this.mergeTagService.process(template.subject, variables);

            const bodyContentHtml = template.designJson
                ? await this.emailRendererService.renderDesignJson(template.designJson, variables)
                : this.mergeTagService.process(template.body, variables);

            const isPlatformTrigger = TransactionalEmailService.PLATFORM_TRIGGERS.has(trigger);
            const finalOrganizationId = isPlatformTrigger ? null : organizationId;

            const organization = variables.organization ?? null;
            const finalHtml = await this.emailRendererService.renderWithOrganizationLayout(bodyContentHtml, organization, variables, {
                senderIdentity: isPlatformTrigger ? 'platform' : 'organization',
            });

            await this.mailService.sendSingle({
                organizationId: finalOrganizationId,
                to: recipientEmail,
                subject: finalSubject,
                html: finalHtml,
            });

            this.logger.log(`E-mail transacional (gatilho: ${trigger}) enviado para ${recipientEmail}.`);
        } catch (error) {
            this.logger.error(`Falha ao orquestrar e-mail transacional (gatilho: ${trigger}) para ${recipientEmail}.`, (error as Error).stack);
        }
    }

    async sendOrganizationAdminWelcomeEmail(
        admin: { name: string; email: string; organizationId: string | null },
        organizationName: string,
        activationLink: string,
    ): Promise<void> {
        const context: MergeTagContext = {
            organization: { name: organizationName },
            organization_name: organizationName,
            user: { name: admin.name, email: admin.email },
            user_name: admin.name,
            login_link: activationLink,
        };

        await this.sendEmailByTrigger(admin.email, EmailTriggerType.ORGANIZATION_ADMIN_WELCOME, context, admin.organizationId);
    }

    async sendPasswordResetEmail(user: { name: string; email: string; organizationId: string | null }, resetLink: string): Promise<void> {
        const context: MergeTagContext = {
            user: { name: user.name, email: user.email },
            user_name: user.name,
            password_reset_link: resetLink,
        };

        // organizationId aqui só influencia qual TEMPLATE (cópia/texto) é usado — o envio em
        // si sai sempre pela conta da plataforma, forçado dentro de sendEmailByTrigger via
        // PLATFORM_TRIGGERS, mesmo que a academia do usuário tenha Resend próprio.
        await this.sendEmailByTrigger(user.email, EmailTriggerType.PASSWORD_RESET, context, user.organizationId);
    }

    async sendCertificateExpiringEmail(
        student: { name: string; email: string },
        organizationId: string,
        organizationName: string,
        courseName: string,
        expiresAtLabel: string,
        link: string,
    ): Promise<void> {
        const context: MergeTagContext = {
            organization: { name: organizationName },
            organization_name: organizationName,
            user: { name: student.name, email: student.email },
            user_name: student.name,
            student: { name: student.name },
            student_name: student.name,
            course: { name: courseName },
            certificate: { expiresAt: expiresAtLabel, link },
        };

        await this.sendEmailByTrigger(student.email, EmailTriggerType.CERTIFICATE_EXPIRING, context, organizationId);
    }

    /**
     * Boas-vindas para uma pessoa recém-cadastrada dentro de uma academia já
     * existente (aluno, instrutor, equipe...) — diferente de
     * ORGANIZATION_ADMIN_WELCOME (que é a própria academia sendo criada).
     * Não entra em PLATFORM_TRIGGERS: sai pelo Resend da própria academia,
     * igual a CERTIFICATE_EXPIRING.
     */
    async sendUserWelcomeEmail(
        user: { name: string; email: string },
        organizationId: string,
        organizationName: string,
        activationLink: string,
    ): Promise<void> {
        const context: MergeTagContext = {
            organization: { name: organizationName },
            organization_name: organizationName,
            user: { name: user.name, email: user.email },
            user_name: user.name,
            login_link: activationLink,
        };

        await this.sendEmailByTrigger(user.email, EmailTriggerType.USER_WELCOME, context, organizationId);
    }

    /**
     * Credenciais de acesso pra quem teve o autocadastro público (registrations/) aprovado
     * por um staff da academia — gatilho próprio (não USER_WELCOME) porque a mensagem faz
     * sentido ser diferente do "boas-vindas" de quando um admin cadastra alguém manualmente.
     * Mesma regra de remetente de USER_WELCOME: sai pelo Resend da própria academia.
     */
    async sendRegistrationApprovedEmail(
        user: { name: string; email: string },
        organizationId: string,
        organizationName: string,
        activationLink: string,
    ): Promise<void> {
        const context: MergeTagContext = {
            organization: { name: organizationName },
            organization_name: organizationName,
            user: { name: user.name, email: user.email },
            user_name: user.name,
            login_link: activationLink,
        };

        await this.sendEmailByTrigger(user.email, EmailTriggerType.REGISTRATION_APPROVED, context, organizationId);
    }
}
