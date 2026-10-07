// backend/prisma/seed-data/default-email-templates.ts
//
// Templates padrão globais (organizationId: null) para os gatilhos de e-mail
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
        name: 'Padrão — Boas-vindas de novo usuário',
        trigger: EmailTriggerType.USER_WELCOME,
        subject: 'Bem-vindo(a) à {{organization_name}}!',
        body: `
            <h2>Bem-vindo(a)!</h2>
            <p>Olá, {{user.name | firstname}}.</p>
            <p>Sua conta em <strong>{{organization_name}}</strong> foi criada. Clique no botão abaixo para definir sua senha e acessar o sistema.</p>
            <p style="text-align: center; margin: 24px 0;">
                <a href="{{login_link}}" style="display: inline-block; background-color: #007bff; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold;">Definir minha senha e acessar</a>
            </p>
            <p>Se você não esperava este e-mail, pode ignorá-lo com segurança.</p>
        `.trim(),
    },
    {
        name: 'Padrão — Cadastro aprovado (autocadastro público)',
        trigger: EmailTriggerType.REGISTRATION_APPROVED,
        subject: 'Seu cadastro em {{organization_name}} foi aprovado!',
        body: `
            <h2>Cadastro aprovado!</h2>
            <p>Olá, {{user.name | firstname}}.</p>
            <p>Seu cadastro em <strong>{{organization_name}}</strong> foi revisado e aprovado. Clique no botão abaixo para definir sua senha e acessar o sistema.</p>
            <p style="text-align: center; margin: 24px 0;">
                <a href="{{login_link}}" style="display: inline-block; background-color: #007bff; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold;">Definir minha senha e acessar</a>
            </p>
            <p>Se você não esperava este e-mail, pode ignorá-lo com segurança.</p>
        `.trim(),
    },
    {
        name: 'Padrão — Cadastro recusado (autocadastro público)',
        trigger: EmailTriggerType.REGISTRATION_REJECTED,
        subject: 'Sobre o seu cadastro em {{organization_name}}',
        body: `
            <p>Olá, {{user.name | firstname}}.</p>
            <p>Analisamos o seu cadastro em <strong>{{organization_name}}</strong> e, neste momento, não foi possível aprová-lo.</p>
            {{#if rejection_reason}}<p><strong>Motivo:</strong> {{rejection_reason}}</p>{{/if}}
            <p>Se você acha que houve um engano, entre em contato diretamente com a academia.</p>
        `.trim(),
    },
    {
        name: 'Padrão — Convite para se cadastrar',
        trigger: EmailTriggerType.REGISTRATION_INVITE,
        subject: 'Você foi convidado(a) para {{organization_name}}',
        body: `
            <h2>Você foi convidado(a)!</h2>
            <p>Olá{{#if user.name}}, {{user.name | firstname}}{{/if}}.</p>
            <p><strong>{{organization_name}}</strong> convidou você para se cadastrar como <strong>{{invite_kind}}</strong>. Preencha seus dados pelo botão abaixo — o link é pessoal e vale por 7 dias.</p>
            <p style="text-align: center; margin: 24px 0;">
                <a href="{{invite_link}}" style="display: inline-block; background-color: #007bff; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold;">Completar meu cadastro</a>
            </p>
            <p>Se você não esperava este e-mail, pode ignorá-lo com segurança.</p>
        `.trim(),
    },
    {
        name: 'Padrão — Certificado vencendo',
        trigger: EmailTriggerType.CERTIFICATE_EXPIRING,
        subject: 'Seu certificado vence em {{certificate.expiresAt}}',
        body: `
            <p>Olá, {{user.name | firstname}}.</p>
            <p>Seu certificado da turma <strong>{{course.name}}</strong> vence em <strong>{{certificate.expiresAt}}</strong> (faltam {{certificate.daysLeft}} dias). Para continuar habilitado(a), faça a reciclagem antes dessa data.</p>
            {{#if recycling.courseName}}<p>Próxima turma de reciclagem: <strong>{{recycling.courseName}}</strong>, com início em {{recycling.startDate}}. Fale com a {{organization_name}} para garantir sua vaga.</p>{{/if}}
            <p style="text-align: center; margin: 24px 0;">
                <a href="{{certificate.link}}" style="display: inline-block; background-color: #007bff; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold;">Ver meus certificados</a>
            </p>
            <p style="font-size: 12px; color: #6c757d;">Código do certificado: {{certificate.code}}</p>
        `.trim(),
    },
    {
        name: 'Padrão — Certificado vencido',
        trigger: EmailTriggerType.CERTIFICATE_EXPIRED,
        subject: 'Seu certificado de {{course.name}} venceu',
        body: `
            <p>Olá, {{user.name | firstname}}.</p>
            <p>Seu certificado da turma <strong>{{course.name}}</strong> venceu em <strong>{{certificate.expiresAt}}</strong> e não comprova mais a sua habilitação. Para regularizar, é preciso fazer a reciclagem.</p>
            {{#if recycling.courseName}}<p>Próxima turma de reciclagem: <strong>{{recycling.courseName}}</strong>, com início em {{recycling.startDate}}.</p>{{/if}}
            <p style="text-align: center; margin: 24px 0;">
                <a href="{{certificate.link}}" style="display: inline-block; background-color: #007bff; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold;">Ver meus certificados</a>
            </p>
            <p>Fale com a {{organization_name}} para saber das próximas turmas.</p>
        `.trim(),
    },
    {
        name: 'Padrão — Certificado emitido',
        trigger: EmailTriggerType.CERTIFICATE_ISSUED,
        subject: 'Parabéns! Seu certificado de {{course.name}} está disponível',
        body: `
            <h2>Parabéns pela conclusão!</h2>
            <p>Olá, {{user.name | firstname}}.</p>
            <p>Seu certificado do curso <strong>{{course.name}}</strong> já foi emitido e está disponível, junto com o seu crachá digital (com QR Code de verificação).</p>
            <p style="text-align: center; margin: 24px 0;">
                <a href="{{certificate.link}}" style="display: inline-block; background-color: #007bff; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold;">Ver meu certificado</a>
            </p>
            <p>Guarde-o com cuidado: ele comprova a sua qualificação perante empresas e fiscalizações.</p>
        `.trim(),
    },
    {
        name: 'Padrão — Matrícula confirmada',
        trigger: EmailTriggerType.ENROLLMENT_CONFIRMED,
        subject: 'Matrícula confirmada em {{course.name}}',
        body: `
            <h2>Matrícula confirmada!</h2>
            <p>Olá, {{user.name | firstname}}.</p>
            <p>Sua matrícula na turma <strong>{{course.name}}</strong> da {{organization_name}} está confirmada.</p>
            <p>Início: <strong>{{course.startDate}}</strong>{{#if course.location}}<br />Local: <strong>{{course.location}}</strong>{{/if}}</p>
            <p style="text-align: center; margin: 24px 0;">
                <a href="{{course.link}}" style="display: inline-block; background-color: #007bff; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold;">Ver minha turma</a>
            </p>
            <p>Fique de olho nos avisos: datas, horários e materiais aparecem na sua área.</p>
        `.trim(),
    },
    {
        name: 'Padrão — Nova designação em evento',
        trigger: EmailTriggerType.DESIGNATION_ASSIGNED,
        subject: 'Você foi escalado(a) para {{event.name}}',
        body: `
            <h2>Nova designação</h2>
            <p>Olá, {{user.name | firstname}}.</p>
            <p>Você foi designado(a) para o evento <strong>{{event.name}}</strong>, em <strong>{{event.date}}</strong>, na função de <strong>{{designation.role}}</strong>.</p>
            <p style="text-align: center; margin: 24px 0;">
                <a href="{{event.link}}" style="display: inline-block; background-color: #007bff; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold;">Ver detalhes e confirmar</a>
            </p>
            <p>Se não puder comparecer, avise a coordenação o quanto antes para que a escala seja reorganizada.</p>
        `.trim(),
    },
];
