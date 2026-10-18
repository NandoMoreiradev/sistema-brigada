import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CommunicationAudience, CommunicationStatus } from '@prisma/client';
import { CommunicationBroadcastService } from './communication-broadcast.service';

const ORG = 'org-1';

function build({ existing = {}, categoryExists = true } = {}) {
    const prisma = {
        user: { findMany: jest.fn().mockResolvedValue([{ id: 'u1', name: 'Ana', email: 'ana@x.com' }]) },
        staffCategory: { findFirst: jest.fn().mockResolvedValue(categoryExists ? { id: 'cat-1' } : null) },
        communication: {
            findFirst: jest.fn().mockResolvedValue({
                id: 'c1',
                status: CommunicationStatus.DRAFT,
                audience: CommunicationAudience.ALL,
                staffCategoryId: null,
                subject: 'Olá',
                customRecipientUserIds: [],
                recipients: [],
                ...existing,
            }),
            update: jest.fn().mockResolvedValue({}),
        },
    };
    const config = { get: jest.fn() };
    const service = new CommunicationBroadcastService(prisma as never, {} as never, {} as never, {} as never, config as never);
    return { service, prisma };
}

describe('CommunicationBroadcastService — público "equipe por categoria"', () => {
    it('só alcança a equipe ATIVA da categoria escolhida', async () => {
        const { service, prisma } = build();

        await service.resolveRecipients(ORG, CommunicationAudience.STAFF_CATEGORY, [], 'cat-1');

        expect(prisma.user.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ where: { organizationId: ORG, isActive: true, staffMember: { status: 'ACTIVE', categoryId: 'cat-1' } } }),
        );
    });

    it('sem categoria falha em vez de virar "toda a equipe"', async () => {
        const { service, prisma } = build();

        await expect(service.resolveRecipients(ORG, CommunicationAudience.STAFF_CATEGORY, [], null)).rejects.toBeInstanceOf(BadRequestException);
        expect(prisma.user.findMany).not.toHaveBeenCalled();
    });

    it('o público "toda a equipe" continua sem filtro de categoria', async () => {
        const { service, prisma } = build();

        await service.resolveRecipients(ORG, CommunicationAudience.STAFF, [], null);

        expect(prisma.user.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { organizationId: ORG, isActive: true, staffMember: { status: 'ACTIVE' } } }));
    });

    it('rascunho cuja categoria foi excluída não envia', async () => {
        const { service, prisma } = build({ existing: { audience: CommunicationAudience.STAFF_CATEGORY, staffCategoryId: null } });

        await expect(service.send('c1', ORG)).rejects.toBeInstanceOf(BadRequestException);
        expect(prisma.user.findMany).not.toHaveBeenCalled();
    });

    it('rejeita categoria de outra academia ao salvar o rascunho', async () => {
        const { service, prisma } = build({ categoryExists: false });

        await expect(service.update('c1', ORG, { audience: CommunicationAudience.STAFF_CATEGORY, staffCategoryId: 'cat-de-fora' })).rejects.toBeInstanceOf(NotFoundException);
        expect(prisma.communication.update).not.toHaveBeenCalled();
    });

    it('grava a categoria no público por categoria e a limpa ao trocar para outro público', async () => {
        const { service, prisma } = build();
        await service.update('c1', ORG, { audience: CommunicationAudience.STAFF_CATEGORY, staffCategoryId: 'cat-1' });
        expect(prisma.communication.update.mock.calls[0][0].data).toMatchObject({ audience: CommunicationAudience.STAFF_CATEGORY, staffCategoryId: 'cat-1' });

        const other = build({ existing: { audience: CommunicationAudience.STAFF_CATEGORY, staffCategoryId: 'cat-1' } });
        await other.service.update('c1', ORG, { audience: CommunicationAudience.STUDENTS });
        expect(other.prisma.communication.update.mock.calls[0][0].data).toMatchObject({ audience: CommunicationAudience.STUDENTS, staffCategoryId: null });
    });

    it('salvar só o assunto de um rascunho sem categoria (excluída) não dá erro nem troca o público', async () => {
        const { service, prisma } = build({ existing: { audience: CommunicationAudience.STAFF_CATEGORY, staffCategoryId: null } });

        await service.update('c1', ORG, { subject: 'Novo assunto' });

        expect(prisma.communication.update.mock.calls[0][0].data).toMatchObject({ subject: 'Novo assunto', staffCategoryId: null });
    });
});
