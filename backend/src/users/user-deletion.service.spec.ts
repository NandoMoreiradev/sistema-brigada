import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { UserDeletionService, tombstoneEmail } from './user-deletion.service';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';

const ORG = 'org-1';

const actor = (overrides: Partial<AuthenticatedUser> = {}) => ({ id: 'admin-1', role: Role.ORG_ADMIN, ...overrides }) as AuthenticatedUser;

const person = (overrides: Record<string, unknown> = {}) => ({
    id: 'user-1',
    name: 'Maria Souza',
    email: 'maria@exemplo.com',
    role: Role.ORG_USER,
    isActive: true,
    isSuperAdminRoot: false,
    ...overrides,
});

const HISTORY_MODELS = [
    'enrollment',
    'certificate',
    'designation',
    'occurrenceReport',
    'occurrenceReportFile',
    'courseInstructor',
    'courseModuleInstructor',
    'classSessionInstructor',
    'classLog',
    'lessonProgress',
    'meetingAttendance',
    'event',
    'eventFile',
    'communication',
] as const;

const OWN_DATA_MODELS = [
    'refreshToken',
    'userIntegration',
    'notification',
    'userAvailability',
    'timeOff',
    'userOrganizationAccess',
    'communicationRecipient',
    'externalCertification',
    'staffMember',
    'studentProfile',
    'personProfile',
] as const;

/** Prisma falso: o mesmo objeto serve de client e de `tx` dentro de `$transaction`. */
function buildPrisma(target: ReturnType<typeof person> | null, counts: Partial<Record<(typeof HISTORY_MODELS)[number], number>> = {}, otherAdmins = 1) {
    const prisma: any = {
        user: {
            findFirst: jest.fn().mockResolvedValue(target),
            count: jest.fn().mockResolvedValue(otherAdmins),
            update: jest.fn().mockResolvedValue({}),
        },
        $transaction: jest.fn((fn: (tx: unknown) => unknown) => fn(prisma)),
    };
    for (const model of HISTORY_MODELS) prisma[model] = { count: jest.fn().mockResolvedValue(counts[model] ?? 0) };
    for (const model of OWN_DATA_MODELS) prisma[model] = { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) };
    return prisma;
}

const build = (prisma: any) => new UserDeletionService(prisma);

describe('UserDeletionService', () => {
    describe('check', () => {
        it('libera quem não tem histórico', async () => {
            const result = await build(buildPrisma(person())).check('user-1', ORG, actor());
            expect(result).toEqual({ canDelete: true, blockers: [], isActive: true });
        });

        it('lista cada tipo de histórico com a contagem', async () => {
            const prisma = buildPrisma(person(), { enrollment: 2, designation: 1, occurrenceReport: 1 });
            const result = await build(prisma).check('user-1', ORG, actor());

            expect(result.canDelete).toBe(false);
            expect(result.blockers).toEqual([
                { code: 'ENROLLMENTS', count: 2, message: '2 matrículas' },
                { code: 'DESIGNATIONS', count: 1, message: '1 escala em evento' },
                { code: 'OCCURRENCE_REPORTS', count: 1, message: '1 relatório de ocorrência' },
            ]);
        });

        it('bloqueia a própria conta', async () => {
            const result = await build(buildPrisma(person({ id: 'admin-1' }))).check('admin-1', ORG, actor());
            expect(result.blockers.map((b) => b.code)).toContain('SELF');
        });

        it('bloqueia administrador de plataforma ou de grupo', async () => {
            for (const role of [Role.SUPER_ADMIN, Role.GROUP_ADMIN]) {
                const result = await build(buildPrisma(person({ role }))).check('user-1', ORG, actor());
                expect(result.blockers.map((b) => b.code)).toContain('PLATFORM_ROLE');
            }
        });

        it('bloqueia excluir o único administrador ativo da academia', async () => {
            const result = await build(buildPrisma(person({ role: Role.ORG_ADMIN }), {}, 0)).check('user-1', ORG, actor());
            expect(result.blockers.map((b) => b.code)).toEqual(['LAST_ADMIN']);
        });

        it('permite excluir um administrador se sobra outro ativo', async () => {
            const result = await build(buildPrisma(person({ role: Role.ORG_ADMIN }), {}, 1)).check('user-1', ORG, actor());
            expect(result.canDelete).toBe(true);
        });

        it('só administrador exclui administrador', async () => {
            const result = await build(buildPrisma(person({ role: Role.ORG_ADMIN }))).check('user-1', ORG, actor({ role: Role.ORG_USER }));
            expect(result.blockers.map((b) => b.code)).toEqual(['ADMIN_REQUIRES_ADMIN']);
        });

        it('devolve 404 para pessoa de outra organização', async () => {
            await expect(build(buildPrisma(null)).check('user-1', ORG, actor())).rejects.toBeInstanceOf(NotFoundException);
        });
    });

    describe('remove', () => {
        it('recusa a própria conta antes de tocar no banco', async () => {
            const prisma = buildPrisma(person({ id: 'admin-1' }));
            await expect(build(prisma).remove('admin-1', ORG, actor())).rejects.toBeInstanceOf(BadRequestException);
            expect(prisma.$transaction).not.toHaveBeenCalled();
        });

        it('recusa com 409 e a lista de bloqueios, sem apagar nada', async () => {
            const prisma = buildPrisma(person(), { certificate: 1 });

            const error: any = await build(prisma).remove('user-1', ORG, actor()).catch((e) => e);

            expect(error).toBeInstanceOf(ConflictException);
            expect(error.getResponse().blockers).toEqual([{ code: 'CERTIFICATES', count: 1, message: '1 certificado' }]);
            expect(error.getResponse().message).toContain('Desative a pessoa');
            expect(prisma.user.update).not.toHaveBeenCalled();
            for (const model of OWN_DATA_MODELS) expect(prisma[model].deleteMany).not.toHaveBeenCalled();
        });

        it('faz o soft delete, libera o e-mail e limpa os dados da pessoa', async () => {
            const prisma = buildPrisma(person());

            const result = await build(prisma).remove('user-1', ORG, actor());

            expect(result.message).toBe('Maria Souza foi excluído(a).');
            for (const model of OWN_DATA_MODELS) expect(prisma[model].deleteMany).toHaveBeenCalledWith({ where: { userId: 'user-1' } });

            const { where, data } = prisma.user.update.mock.calls[0][0];
            expect(where).toEqual({ id: 'user-1' });
            expect(data.deletedAt).toBeInstanceOf(Date);
            expect(data).toMatchObject({
                isActive: false,
                email: tombstoneEmail('user-1', 'maria@exemplo.com'),
                phone: null,
                isTwoFactorEnabled: false,
                twoFactorSecret: null,
                directPermissions: [],
                roleAssignments: { set: [] },
            });
            expect(data.email).not.toBe('maria@exemplo.com');
            expect(data.publicBadgeToken).toEqual(expect.any(String));
        });

        it('o e-mail de tombstone é único por pessoa e preserva o original', () => {
            expect(tombstoneEmail('a', 'x@y.com')).not.toBe(tombstoneEmail('b', 'x@y.com'));
            expect(tombstoneEmail('a', 'x@y.com')).toContain('x@y.com');
        });
    });
});
