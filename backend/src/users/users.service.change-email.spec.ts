import { BadRequestException, ConflictException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { UsersService } from './users.service';

const ORG = 'org-1';

function build(target: Partial<{ role: Role; isActive: boolean; email: string; isSuperAdminRoot: boolean }> = {}, emailTaken = false) {
    const tx = { user: { update: jest.fn().mockResolvedValue({}) }, refreshToken: { deleteMany: jest.fn().mockResolvedValue({}) } };
    const prisma = {
        user: {
            findFirst: jest
                .fn()
                // 1ª chamada: a pessoa; 2ª: checagem de e-mail em uso; demais: resendAccess/findOne
                .mockResolvedValueOnce({ id: 'u1', name: 'Ana', email: 'velho@x.com', isActive: true, role: Role.ORG_USER, isSuperAdminRoot: false, ...target })
                .mockResolvedValueOnce(emailTaken ? { id: 'u2' } : null)
                .mockResolvedValue({ id: 'u1', name: 'Ana', email: 'novo@x.com', isActive: true }),
        },
        organization: { findUnique: jest.fn().mockResolvedValue({ name: 'Org' }) },
        $transaction: jest.fn(async (fn: any) => fn(tx)),
    };
    const auth = { createPasswordResetToken: jest.fn().mockReturnValue('tok') };
    const mail = { sendEmailChangedEmail: jest.fn().mockResolvedValue(true) };
    const service = new UsersService(prisma as any, auth as any, mail as any);
    return { service, prisma, tx, mail };
}

describe('UsersService.changeEmail', () => {
    it('troca o e-mail, derruba as sessões e envia o acesso ao novo endereço', async () => {
        const { service, tx, mail } = build();

        const result = await service.changeEmail('u1', ORG, ' novo@x.com ', 'admin-1');

        expect(tx.user.update).toHaveBeenCalledWith({ where: { id: 'u1' }, data: { email: 'novo@x.com' } });
        expect(tx.refreshToken.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u1' } });
        expect(mail.sendEmailChangedEmail).toHaveBeenCalledWith({ name: 'Ana', email: 'novo@x.com' }, ORG, 'Org', expect.stringContaining('token=tok'));
        expect(result.sent).toBe(true);
    });

    it('recusa e-mail já usado por outra conta', async () => {
        const { service, tx } = build({}, true);

        await expect(service.changeEmail('u1', ORG, 'outro@x.com', 'admin-1')).rejects.toBeInstanceOf(ConflictException);
        expect(tx.user.update).not.toHaveBeenCalled();
    });

    it('recusa o mesmo e-mail, a própria conta e administradores da plataforma', async () => {
        await expect(build().service.changeEmail('u1', ORG, 'VELHO@x.com', 'admin-1')).rejects.toBeInstanceOf(BadRequestException);
        await expect(build().service.changeEmail('u1', ORG, 'novo@x.com', 'u1')).rejects.toBeInstanceOf(BadRequestException);
        await expect(build({ role: Role.GROUP_ADMIN }).service.changeEmail('u1', ORG, 'novo@x.com', 'admin-1')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('troca o e-mail de pessoa inativa sem enviar acesso', async () => {
        const { service, tx, mail } = build({ isActive: false });

        const result = await service.changeEmail('u1', ORG, 'novo@x.com', 'admin-1');

        expect(tx.user.update).toHaveBeenCalled();
        expect(mail.sendEmailChangedEmail).not.toHaveBeenCalled();
        expect(result.sent).toBe(false);
    });
});
