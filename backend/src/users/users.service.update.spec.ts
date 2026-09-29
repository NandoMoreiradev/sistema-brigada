import { BadRequestException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { UsersService } from './users.service';

const ORG = 'org-1';

function build(target: { role: Role; isActive?: boolean }, otherActiveAdmins: number) {
    const tx = { user: { update: jest.fn().mockResolvedValue({}) }, studentProfile: {}, personProfile: {} };
    const prisma = {
        user: {
            findFirst: jest.fn().mockResolvedValue({ id: 'u1', isActive: true, studentProfile: null, personProfile: null, ...target }),
            count: jest.fn().mockResolvedValue(otherActiveAdmins),
            findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'u1' }),
        },
        $transaction: jest.fn(async (fn: any) => fn(tx)),
    };
    const service = new UsersService(prisma as any, {} as any, {} as any);
    return { service, prisma, tx };
}

describe('UsersService.update — desativar administrador', () => {
    it('bloqueia desativar o único admin ativo da academia', async () => {
        const { service, tx } = build({ role: Role.ORG_ADMIN }, 0);

        await expect(service.update('u1', ORG, { isActive: false })).rejects.toBeInstanceOf(BadRequestException);
        expect(tx.user.update).not.toHaveBeenCalled();
    });

    it('permite desativar um admin quando há outro admin ativo', async () => {
        const { service, prisma, tx } = build({ role: Role.ORG_ADMIN }, 1);

        await service.update('u1', ORG, { isActive: false }).catch(() => undefined);

        expect(prisma.user.count).toHaveBeenCalledWith({
            where: { organizationId: ORG, id: { not: 'u1' }, isActive: true, role: { in: [Role.ORG_ADMIN, Role.GROUP_ADMIN] } },
        });
        expect(tx.user.update).toHaveBeenCalled();
    });

    it('não consulta admins ao desativar quem não é admin, nem ao editar só o nome do admin', async () => {
        const student = build({ role: Role.ORG_USER }, 0);
        await student.service.update('u1', ORG, { isActive: false }).catch(() => undefined);
        expect(student.prisma.user.count).not.toHaveBeenCalled();
        expect(student.tx.user.update).toHaveBeenCalled();

        const admin = build({ role: Role.ORG_ADMIN }, 0);
        await admin.service.update('u1', ORG, { name: 'Novo nome' }).catch(() => undefined);
        expect(admin.tx.user.update).toHaveBeenCalled();
    });
});
