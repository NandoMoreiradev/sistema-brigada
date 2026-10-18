import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { StaffStatus } from '@prisma/client';
import { StaffService } from './staff.service';

const ORG = 'org-1';
const ADMIN = 'admin-1';

type Member = { id: string; userId: string; status: StaffStatus };

function build({ users = [] as string[], members = [] as Member[], category = true as boolean, categoryUsage = 0, nameClash = false } = {}) {
    const tx = {
        staffMember: {
            findMany: jest.fn().mockResolvedValue(members),
            create: jest.fn().mockResolvedValue({}),
            update: jest.fn().mockResolvedValue({}),
        },
    };
    const prisma = {
        user: { findMany: jest.fn().mockResolvedValue(users.map((id) => ({ id }))) },
        staffMember: { count: jest.fn().mockResolvedValue(categoryUsage) },
        staffCategory: {
            findFirst: jest.fn(async (args: { where: { name?: unknown } }) => {
                // assertNameAvailable consulta por nome; requireCategory, por id.
                if (args.where.name) return nameClash ? { id: 'outra' } : null;
                return category ? { id: 'cat-1', organizationId: ORG } : null;
            }),
            create: jest.fn().mockResolvedValue({ id: 'cat-new' }),
            update: jest.fn().mockResolvedValue({ id: 'cat-1' }),
            delete: jest.fn().mockResolvedValue({}),
        },
        $transaction: jest.fn(async (fn: (client: typeof tx) => unknown) => fn(tx)),
    };
    return { service: new StaffService(prisma as never), prisma, tx };
}

describe('StaffService.promoteMany', () => {
    it('cria quem ainda não é da equipe, reativa quem estava inativo e ignora quem já é ativo', async () => {
        const { service, tx } = build({
            users: ['u1', 'u2', 'u3'],
            members: [
                { id: 'm2', userId: 'u2', status: StaffStatus.INACTIVE },
                { id: 'm3', userId: 'u3', status: StaffStatus.ACTIVE },
            ],
        });

        const result = await service.promoteMany(['u1', 'u2', 'u3'], ORG, ADMIN, 'cat-1');

        expect(result).toEqual({ promoted: 2, skipped: 1 });
        expect(tx.staffMember.create).toHaveBeenCalledTimes(1);
        expect(tx.staffMember.create).toHaveBeenCalledWith({ data: { userId: 'u1', organizationId: ORG, approvedByUserId: ADMIN, categoryId: 'cat-1' } });
        expect(tx.staffMember.update).toHaveBeenCalledTimes(1);
        expect(tx.staffMember.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'm2' }, data: expect.objectContaining({ status: StaffStatus.ACTIVE, categoryId: 'cat-1' }) }));
    });

    it('não troca a categoria de quem foi reativado quando nenhuma categoria é informada', async () => {
        const { service, tx } = build({ users: ['u2'], members: [{ id: 'm2', userId: 'u2', status: StaffStatus.INACTIVE }] });

        await service.promoteMany(['u2'], ORG, ADMIN);

        expect(tx.staffMember.update.mock.calls[0][0].data).not.toHaveProperty('categoryId');
    });

    it('conta uma vez só um id repetido', async () => {
        const { service, tx } = build({ users: ['u1'] });

        const result = await service.promoteMany(['u1', 'u1'], ORG, ADMIN);

        expect(result).toEqual({ promoted: 1, skipped: 0 });
        expect(tx.staffMember.create).toHaveBeenCalledTimes(1);
    });

    it('não promove ninguém se algum id não pertence à academia', async () => {
        const { service, prisma } = build({ users: ['u1'] });

        await expect(service.promoteMany(['u1', 'fora'], ORG, ADMIN)).rejects.toBeInstanceOf(NotFoundException);
        expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rejeita categoria de outra academia', async () => {
        const { service, prisma } = build({ users: ['u1'], category: false });

        await expect(service.promoteMany(['u1'], ORG, ADMIN, 'cat-x')).rejects.toBeInstanceOf(NotFoundException);
        expect(prisma.$transaction).not.toHaveBeenCalled();
    });
});

describe('StaffService — catálogo de categorias', () => {
    it('não deixa excluir categoria que ainda tem gente', async () => {
        const { service, prisma } = build({ categoryUsage: 2 });

        await expect(service.removeCategory('cat-1', ORG)).rejects.toBeInstanceOf(ConflictException);
        expect(prisma.staffCategory.delete).not.toHaveBeenCalled();
    });

    it('exclui categoria sem ninguém', async () => {
        const { service, prisma } = build({ categoryUsage: 0 });

        await service.removeCategory('cat-1', ORG);

        expect(prisma.staffCategory.delete).toHaveBeenCalledWith({ where: { id: 'cat-1' } });
    });

    it('recusa nome em branco (só espaços) ao criar e ao renomear', async () => {
        const { service, prisma } = build();

        await expect(service.createCategory(ORG, '   ')).rejects.toBeInstanceOf(BadRequestException);
        await expect(service.updateCategory('cat-1', ORG, '  ')).rejects.toBeInstanceOf(BadRequestException);
        expect(prisma.staffCategory.create).not.toHaveBeenCalled();
        expect(prisma.staffCategory.update).not.toHaveBeenCalled();
    });

    it('recusa nome repetido (sem diferenciar maiúsculas) e grava o nome sem espaços nas pontas', async () => {
        const clash = build({ nameClash: true });
        await expect(clash.service.createCategory(ORG, 'brigadista')).rejects.toBeInstanceOf(ConflictException);
        expect(clash.prisma.staffCategory.create).not.toHaveBeenCalled();

        const ok = build();
        await ok.service.createCategory(ORG, '  Socorrista  ');
        expect(ok.prisma.staffCategory.create).toHaveBeenCalledWith(expect.objectContaining({ data: { organizationId: ORG, name: 'Socorrista' } }));
    });
});
