import { NotFoundException } from '@nestjs/common';
import { RegistrationKind, RegistrationRequestStatus } from '@prisma/client';
import { RegistrationsService } from './registrations.service';

const ORG = 'org-1';

function build({ categoryExists = true, requestedKind = RegistrationKind.STAFF as RegistrationKind } = {}) {
    const request = {
        id: 'r1',
        organizationId: ORG,
        name: 'Ana',
        email: 'ana@x.com',
        phone: '1',
        status: RegistrationRequestStatus.PENDING,
        requestedKind,
        birthDate: null,
        baptismDate: null,
        pioneerStatus: null,
        signedPetitions: [],
        profession: null,
    };
    const prisma = {
        user: { findFirst: jest.fn().mockResolvedValue(null) },
        staffCategory: { findFirst: jest.fn().mockResolvedValue(categoryExists ? { id: 'cat-1' } : null) },
        registrationRequest: { findFirst: jest.fn().mockResolvedValue(request), update: jest.fn().mockResolvedValue({}) },
        registrationInvite: {
            updateMany: jest.fn().mockResolvedValue({ count: 0 }),
            create: jest.fn().mockResolvedValue({ id: 'i1', email: 'ana@x.com', name: null, kind: requestedKind, token: 't' }),
            update: jest.fn().mockResolvedValue({}),
            findFirst: jest.fn().mockResolvedValue({ id: 'i1', expiresAt: new Date(Date.now() + 1e6), usedAt: null, revokedAt: null }),
        },
        organization: { findUniqueOrThrow: jest.fn().mockResolvedValue({ name: 'Academia' }) },
    };
    const users = {
        createAccount: jest.fn().mockResolvedValue({ user: { id: 'u1', name: 'Ana', email: 'ana@x.com' }, organizationName: 'Academia', activationLink: 'x' }),
    };
    const email = {
        sendRegistrationApprovedEmail: jest.fn().mockResolvedValue(true),
        sendRegistrationInviteEmail: jest.fn().mockResolvedValue(true),
    };
    const service = new RegistrationsService(prisma as never, users as never, {} as never, email as never);
    return { service, prisma, users };
}

describe('RegistrationsService — categoria da equipe', () => {
    it('convite de equipe grava a categoria escolhida', async () => {
        const { service, prisma } = build();

        await service.createInvite(ORG, 'admin', { email: 'Ana@x.com', kind: RegistrationKind.STAFF, staffCategoryId: 'cat-1' });

        expect(prisma.registrationInvite.create.mock.calls[0][0].data).toMatchObject({ kind: RegistrationKind.STAFF, staffCategoryId: 'cat-1' });
    });

    it('convite de aluno ignora categoria (só vale para equipe)', async () => {
        const { service, prisma } = build({ requestedKind: RegistrationKind.STUDENT });

        await service.createInvite(ORG, 'admin', { email: 'ana@x.com', kind: RegistrationKind.STUDENT, staffCategoryId: 'cat-1' });

        expect(prisma.registrationInvite.create.mock.calls[0][0].data.staffCategoryId).toBeUndefined();
        expect(prisma.staffCategory.findFirst).not.toHaveBeenCalled();
    });

    it('convite com categoria de outra academia: 404 e nenhum convite criado', async () => {
        const { service, prisma } = build({ categoryExists: false });

        await expect(service.createInvite(ORG, 'admin', { email: 'ana@x.com', kind: RegistrationKind.STAFF, staffCategoryId: 'de-fora' })).rejects.toBeInstanceOf(NotFoundException);
        expect(prisma.registrationInvite.create).not.toHaveBeenCalled();
    });

    it('aprovar como equipe cria a conta já com a categoria escolhida por quem revisa', async () => {
        const { service, users } = build();

        await service.approve('r1', ORG, 'revisor', { staffCategoryId: 'cat-1' });

        expect(users.createAccount.mock.calls[0][0].staff).toEqual({ approvedByUserId: 'revisor', categoryId: 'cat-1' });
    });

    it('aprovar como aluno não cria equipe nem usa a categoria', async () => {
        const { service, users } = build({ requestedKind: RegistrationKind.STUDENT });

        await service.approve('r1', ORG, 'revisor', { staffCategoryId: 'cat-1' });

        expect(users.createAccount.mock.calls[0][0].staff).toBeUndefined();
    });

    it('aprovar com categoria de outra academia: 404 antes de criar a conta', async () => {
        const { service, users } = build({ categoryExists: false });

        await expect(service.approve('r1', ORG, 'revisor', { staffCategoryId: 'de-fora' })).rejects.toBeInstanceOf(NotFoundException);
        expect(users.createAccount).not.toHaveBeenCalled();
    });

    it('aprovar equipe sem categoria continua funcionando (nasce sem categoria)', async () => {
        const { service, users } = build();

        await service.approve('r1', ORG, 'revisor', {});

        expect(users.createAccount.mock.calls[0][0].staff).toEqual({ approvedByUserId: 'revisor', categoryId: undefined });
    });
});
