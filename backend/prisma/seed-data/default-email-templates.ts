// backend/prisma/seed-data/default-email-templates.ts
//
// Templates padrão globais (organizationId: null) para os 3 gatilhos de e-mail
// transacional do produto — ver EmailTriggerType em schema.prisma. `designJson: null`:
// o envio cai para `body` (HTML puro) até alguém abrir e salvar pelo construtor visual
// (frontend/src/components/email-builder), que populariza o designJson organicamente.
// Merge tags disponíveis: ver backend/src/common/constants/merge-tags.constant.ts.

import { EmailTriggerType } from '@prisma/client';

export interface DefaultEmailTemplate {
    name: string;
    subject: string;
    body: string;
    trigger: EmailTriggerType;
}

export const DEFAULT_EMAIL_TEMPLATES: DefaultEmailTemplate[] = [
    {
        name: 'Padrão — Boas-vindas ao administrador da academia',
        trigger: EmailTriggerType.ORGANIZATION_ADMIN_WELCOME,
        subject: 'Bem-vindo(a) à plataforma, {{organization_name}}!',
        body: `
            <h2>Bem-vindo(a) à plataforma!</h2>
            <p>Olá, {{user.name | firstname}}.</p>
            <p>Sua conta de administrador da academia <strong>{{organization_name}}</strong> foi criada com sucesso.</p>
            <p style="text-align: center; margin: 24px 0;">
                <a href="{{login_link}}" style="display: inline-block; background-color: #007bff; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold;">Definir minha senha e acessar</a>
            </p>
            <p>Se você não esperava este e-mail, pode ignorá-lo com segurança.</p>
        `.trim(),
    },
    {
        name: 'Padrão — Redefinição de senha',
        trigger: EmailTriggerType.PASSWORD_RESET,
        subject: 'Redefinição de senha',
        body: `
            <p>Olá, {{user.name | firstname}}.</p>
            <p>Recebemos uma solicitação para redefinir sua senha.</p>
            <p style="text-align: center; margin: 24px 0;">
                <a href="{{password_reset_link}}" style="display: inline-block; background-color: #007bff; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold;">Definir nova senha</a>
            </p>
            <p>Se você não solicitou isso, pode ignorar este e-mail.</p>
        `.trim(),
    },
    {
        name: 'Padrão — Certificado vencendo',
        trigger: EmailTriggerType.CERTIFICATE_EXPIRING,
        subject: 'Seu certificado está vencendo',
        body: `
            <p>Olá, {{user.name | firstname}}.</p>
            <p>Seu certificado da turma <strong>{{course.name}}</strong> vence em {{certificate.expiresAt}}. Verifique se é preciso fazer a reciclagem.</p>
            <p style="text-align: center; margin: 24px 0;">
                <a href="{{certificate.link}}" style="display: inline-block; background-color: #007bff; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold;">Ver meus certificados</a>
            </p>
        `.trim(),
    },
];
