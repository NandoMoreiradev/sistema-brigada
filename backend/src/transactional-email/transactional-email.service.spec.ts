import { EmailTriggerType } from '@prisma/client';
import { TransactionalEmailService } from './transactional-email.service';
import { MergeTagService } from '../common/merge-tag.service';
import { DEFAULT_EMAIL_TEMPLATES } from '../../prisma/seed-data/default-email-templates';

const LINK = 'https://app.exemplo.com/reset-password?token=abc';

function build(templateBody: string) {
    const emailTemplatesService = { findTemplateByTrigger: jest.fn().mockResolvedValue({ subject: 'Assunto', body: templateBody, designJson: null }) };
    const mailService = { sendSingleOrThrow: jest.fn().mockResolvedValue(undefined) };
    const emailRendererService = { renderWithOrganizationLayout: jest.fn(async (html: string) => html), renderDesignJson: jest.fn() };
    const service = new TransactionalEmailService(
        emailTemplatesService as any,
        mailService as any,
        emailRendererService as any,
        new MergeTagService(),
    );
    return { service, mailService };
}

describe('TransactionalEmailService — links de ativação', () => {
    it.each([['{{password_reset_link}}'], ['{{login_link}}']])('e-mail de boas-vindas do admin renderiza o link com %s', async (tag) => {
        const { service, mailService } = build(`<a href="${tag}">Definir senha</a>`);

        await service.sendOrganizationAdminWelcomeEmail({ name: 'Ana', email: 'ana@x.com', organizationId: 'o1' }, 'JB Treinamentos', LINK);

        expect(mailService.sendSingleOrThrow).toHaveBeenCalledWith(expect.objectContaining({ html: `<a href="${LINK}">Definir senha</a>` }));
    });

    it('e-mail de redefinição de senha também aceita {{login_link}}', async () => {
        const { service, mailService } = build('{{login_link}}');

        await service.sendPasswordResetEmail({ name: 'Ana', email: 'ana@x.com', organizationId: null }, LINK);

        expect(mailService.sendSingleOrThrow).toHaveBeenCalledWith(expect.objectContaining({ html: LINK }));
    });

    it('boas-vindas de pessoa e cadastro aprovado renderizam {{password_reset_link}}', async () => {
        for (const send of ['sendUserWelcomeEmail', 'sendRegistrationApprovedEmail'] as const) {
            const { service, mailService } = build('{{password_reset_link}}');
            await service[send]({ name: 'Ana', email: 'ana@x.com' }, 'o1', 'JB', LINK);
            expect(mailService.sendSingleOrThrow).toHaveBeenCalledWith(expect.objectContaining({ html: LINK }));
        }
        expect(EmailTriggerType.USER_WELCOME).toBeDefined();
    });
});

// Auditoria: cada template padrão, renderizado pelo método REAL de envio do seu gatilho,
// não pode sair com tag sem substituir nem com link/valor em branco.

describe('TransactionalEmailService — templates padrão renderizam completos', () => {
    const person = { name: 'Ana Souza', email: 'ana@x.com' };
    const course = { name: 'Brigada Turma 1', startDate: '15/03/2026', location: 'Sede', link: 'https://app/courses/1' };
    const event = { name: 'Simulado', date: '15/03/2026 08:00', location: 'Pátio', link: 'https://app/events/1' };
    const reminder = {
        student: person,
        organizationId: 'o1',
        organizationName: 'JB',
        courseName: 'Brigada Turma 1',
        certificate: {
            expiresAt: '15/03/2026',
            daysLeft: '30',
            code: 'AB3K-9X2M-Q7TD',
            link: 'https://app/my-certificates#c1',
            verifyLink: 'https://app/validar/AB3K9X2MQ7TD',
        },
        recycling: { courseName: 'Reciclagem Brigada — Abril', startDate: '10/04/2026' },
    };

    const senders: Record<string, (s: TransactionalEmailService) => Promise<unknown>> = {
        ORGANIZATION_ADMIN_WELCOME: (s) => s.sendOrganizationAdminWelcomeEmail({ ...person, organizationId: 'o1' }, 'JB', LINK),
        PASSWORD_RESET: (s) => s.sendPasswordResetEmail({ ...person, organizationId: 'o1' }, LINK),
        USER_WELCOME: (s) => s.sendUserWelcomeEmail(person, 'o1', 'JB', LINK),
        REGISTRATION_APPROVED: (s) => s.sendRegistrationApprovedEmail(person, 'o1', 'JB', LINK),
        REGISTRATION_REJECTED: (s) => s.sendRegistrationRejectedEmail(person, 'o1', 'JB', 'Documentação incompleta'),
        REGISTRATION_INVITE: (s) => s.sendRegistrationInviteEmail(person, 'o1', 'JB', 'Aluno', 'https://app/convite/t'),
        CERTIFICATE_EXPIRING: (s) => s.sendCertificateReminderEmail({ ...reminder, expired: false }),
        CERTIFICATE_EXPIRED: (s) => s.sendCertificateReminderEmail({ ...reminder, expired: true, recycling: null }),
        CERTIFICATE_ISSUED: (s) => s.sendCertificateIssuedEmail(person, 'o1', 'JB', 'Brigada Turma 1', 'https://app/my-certificates'),
        ENROLLMENT_CONFIRMED: (s) => s.sendEnrollmentConfirmedEmail(person, 'o1', 'JB', course),
        DESIGNATION_ASSIGNED: (s) => s.sendDesignationAssignedEmail(person, 'o1', 'JB', event, 'Brigadista'),
    };

    it('cobre todos os gatilhos que têm template padrão', () => {
        expect(DEFAULT_EMAIL_TEMPLATES.map((t) => t.trigger).sort()).toEqual(Object.keys(senders).sort());
    });

    it.each(DEFAULT_EMAIL_TEMPLATES.map((t) => [t.trigger, t] as const))('%s', async (trigger, template) => {
        const { service, mailService } = build(template.body);
        await senders[trigger](service);

        const { html, subject } = mailService.sendSingleOrThrow.mock.calls[0][0];
        for (const out of [html, template.subject && new MergeTagService().process(template.subject, { organization_name: 'JB' })]) {
            expect(out).not.toMatch(/\{\{|\}\}/);
        }
        expect(html).not.toMatch(/href=""|href="#"|<strong><\/strong>|em \.|vence em \./);
        expect(subject).toBeDefined();
    });
});
