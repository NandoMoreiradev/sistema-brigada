import { EmailTriggerType } from '@prisma/client';
import { TransactionalEmailService } from './transactional-email.service';
import { MergeTagService } from '../common/merge-tag.service';

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
