import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { TrashService } from './trash.service';
import { cascadeSoftDelete } from '../prisma/prisma.service';

const ORG = 'org-1';
const DELETED_AT = new Date('2026-09-01T12:00:00.000Z');

/** Prisma falso: o mesmo objeto serve de client e de `tx` dentro de `$transaction`. */
function buildPrisma(overrides: Record<string, Record<string, jest.Mock>> = {}) {
    const model = (methods: string[]) => Object.fromEntries(methods.map((m) => [m, jest.fn()]));
    const prisma: any = {
        course: model(['findFirst', 'findMany', 'update']),
        event: model(['findFirst', 'findMany', 'update', 'delete']),
        enrollment: model(['updateMany']),
        meeting: model(['update']),
        user: model(['findFirst', 'findMany', 'update', 'delete']),
        roleAssignment: model(['findFirst', 'findMany', 'update', 'delete']),
        certificate: model(['count', 'findMany']),
        classSession: model(['count']),
        courseModule: model(['count']),
        courseLesson: model(['count', 'findMany']),
        eventFile: model(['count', 'findMany']),
        occurrenceReport: model(['count']),
        occurrenceReportFile: model(['count', 'findMany']),
        eventShift: model(['count']),
        designation: model(['count']),
        eventFloorPlan: model(['count', 'findMany']),
        eventOperation: model(['findUnique']),
        $transaction: jest.fn((fn: (tx: unknown) => unknown) => fn(prisma)),
    };
    for (const [name, methods] of Object.entries(overrides)) Object.assign(prisma[name], methods);
    return prisma;
}

const media = () => ({ deleteObject: jest.fn().mockResolvedValue(undefined) });
const build = (prisma: any, mediaService = media()) => new TrashService(prisma, mediaService as any);

describe('TrashService', () => {
    describe('assertEntity', () => {
        it('aceita os quatro tipos e recusa o resto', () => {
            expect(TrashService.assertEntity('courses')).toBe('courses');
            expect(() => TrashService.assertEntity('organizations')).toThrow('Tipo de lixeira inválido');
        });
    });

    describe('list', () => {
        it('lista turmas excluídas da academia ativa, burlando o filtro de soft delete', async () => {
            const prisma = buildPrisma();
            prisma.course.findMany.mockResolvedValue([
                { id: 'c1', deletedAt: DELETED_AT, category: 'Brigada', event: { title: 'Turma A' }, _count: { enrollments: 2 } },
            ]);
            const items = await build(prisma).list('courses', ORG);

            expect(prisma.course.findMany.mock.calls[0][0].where).toEqual({ organizationId: ORG, deletedAt: { not: null } });
            expect(items).toEqual([{ id: 'c1', name: 'Turma A', deletedAt: DELETED_AT, description: 'Brigada · 2 matrículas' }]);
        });

        it('mostra o e-mail original da pessoa excluída, sem o prefixo do tombstone', async () => {
            const prisma = buildPrisma();
            prisma.user.findMany.mockResolvedValue([{ id: 'u1', name: 'Maria', email: 'deleted:u1:maria@x.com', deletedAt: DELETED_AT }]);
            const [item] = await build(prisma).list('people', ORG);
            expect(item.description).toBe('maria@x.com');
        });

        it('eventos da lixeira não incluem turmas', async () => {
            const prisma = buildPrisma();
            prisma.event.findMany.mockResolvedValue([]);
            await build(prisma).list('events', ORG);
            expect(prisma.event.findMany.mock.calls[0][0].where.kind).toEqual({ not: 'TURMA' });
        });
    });

    describe('restore', () => {
        it('turma: restaura evento, turma e só as matrículas excluídas junto (mesmo deletedAt)', async () => {
            const prisma = buildPrisma();
            prisma.course.findFirst.mockResolvedValue({ id: 'c1', eventId: 'e1', deletedAt: DELETED_AT, event: { id: 'e1', title: 'Turma A' }, _count: { enrollments: 3 } });
            prisma.enrollment.updateMany.mockResolvedValue({ count: 2 });

            const result = await build(prisma).restore('courses', 'c1', ORG);

            expect(prisma.event.update).toHaveBeenCalledWith({ where: { id: 'e1' }, data: { deletedAt: null } });
            expect(prisma.course.update).toHaveBeenCalledWith({ where: { id: 'c1' }, data: { deletedAt: null } });
            expect(prisma.enrollment.updateMany).toHaveBeenCalledWith({ where: { courseId: 'c1', deletedAt: DELETED_AT }, data: { deletedAt: null } });
            expect(result.message).toContain('2 matrículas');
        });

        it('turma fora da lixeira ou de outra academia → 404', async () => {
            const prisma = buildPrisma();
            prisma.course.findFirst.mockResolvedValue(null);
            await expect(build(prisma).restore('courses', 'c1', ORG)).rejects.toBeInstanceOf(NotFoundException);
            expect(prisma.course.findFirst.mock.calls[0][0].where).toEqual({ id: 'c1', organizationId: ORG, deletedAt: { not: null } });
        });

        it('reunião: limpa o id do Google Calendar (já apagado lá) e avisa', async () => {
            const prisma = buildPrisma();
            prisma.event.findFirst.mockResolvedValue({ id: 'e1', title: 'Reunião', meeting: { id: 'm1', googleEventId: 'g1' } });
            const result = await build(prisma).restore('events', 'e1', ORG);

            expect(prisma.meeting.update).toHaveBeenCalledWith({ where: { id: 'm1' }, data: { googleEventId: null, meetUrl: null } });
            expect(result.warnings[0]).toContain('Google Meet');
        });

        it('evento sem reunião: restaura sem avisos', async () => {
            const prisma = buildPrisma();
            prisma.event.findFirst.mockResolvedValue({ id: 'e1', title: 'Congresso', meeting: null });
            const result = await build(prisma).restore('events', 'e1', ORG);
            expect(prisma.meeting.update).not.toHaveBeenCalled();
            expect(result.warnings).toEqual([]);
        });

        it('pessoa: devolve o e-mail original, reativação fica a cargo do admin (conta inativa)', async () => {
            const prisma = buildPrisma();
            prisma.user.findFirst
                .mockResolvedValueOnce({ id: 'u1', name: 'Maria', email: 'deleted:u1:maria@x.com' })
                .mockResolvedValueOnce(null);
            await build(prisma).restore('people', 'u1', ORG);
            expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: 'u1' }, data: { deletedAt: null, isActive: false, email: 'maria@x.com' } });
        });

        it('pessoa: e-mail já ocupado por outra pessoa → 409', async () => {
            const prisma = buildPrisma();
            prisma.user.findFirst.mockResolvedValueOnce({ id: 'u1', name: 'Maria', email: 'deleted:u1:maria@x.com' }).mockResolvedValueOnce({ id: 'u2' });
            await expect(build(prisma).restore('people', 'u1', ORG)).rejects.toBeInstanceOf(ConflictException);
            expect(prisma.user.update).not.toHaveBeenCalled();
        });

        it('pessoa: corrida no e-mail (P2002 no update) → 409', async () => {
            const prisma = buildPrisma();
            prisma.user.findFirst.mockResolvedValueOnce({ id: 'u1', name: 'Maria', email: 'deleted:u1:maria@x.com' }).mockResolvedValueOnce(null);
            prisma.user.update.mockRejectedValue(new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'x' }));
            await expect(build(prisma).restore('people', 'u1', ORG)).rejects.toBeInstanceOf(ConflictException);
        });

        it('cargo: nome reutilizado por outro cargo → 409', async () => {
            const prisma = buildPrisma();
            prisma.roleAssignment.findFirst.mockResolvedValueOnce({ id: 'r1', name: 'Secretaria' }).mockResolvedValueOnce({ id: 'r2' });
            await expect(build(prisma).restore('roles', 'r1', ORG)).rejects.toBeInstanceOf(ConflictException);
            expect(prisma.roleAssignment.update).not.toHaveBeenCalled();
        });

        it('cargo: restaura quando o nome está livre', async () => {
            const prisma = buildPrisma();
            prisma.roleAssignment.findFirst.mockResolvedValueOnce({ id: 'r1', name: 'Secretaria' }).mockResolvedValueOnce(null);
            await build(prisma).restore('roles', 'r1', ORG);
            expect(prisma.roleAssignment.update).toHaveBeenCalledWith({ where: { id: 'r1' }, data: { deletedAt: null } });
        });
    });

    describe('purge', () => {
        const courseFound = { id: 'c1', eventId: 'e1', deletedAt: DELETED_AT, event: { id: 'e1', title: 'Turma A' }, _count: { enrollments: 4 } };

        function coursePrisma() {
            const prisma = buildPrisma();
            prisma.course.findFirst.mockResolvedValue(courseFound);
            prisma.certificate.count.mockResolvedValue(3);
            prisma.classSession.count.mockResolvedValue(5);
            prisma.courseModule.count.mockResolvedValue(2);
            prisma.courseLesson.count.mockResolvedValue(6);
            prisma.courseLesson.findMany.mockResolvedValue([{ videoKey: 'videos/a.mp4' }]);
            prisma.certificate.findMany.mockResolvedValue([{ pdfKey: 'certs/1.pdf' }, { pdfKey: 'certs/2.pdf' }]);
            prisma.event.delete.mockResolvedValue({});
            return prisma;
        }

        it('purge-check de turma mostra contagens e arquivos', async () => {
            const check = await build(coursePrisma()).purgeCheck('courses', 'c1', ORG);
            expect(check.name).toBe('Turma A');
            expect(check.files).toBe(3);
            expect(check.items).toContainEqual({ label: 'matrículas', count: 4 });
            expect(check.items).toContainEqual({ label: 'certificados emitidos', count: 3 });
        });

        it('turma: exclui fisicamente o Event e remove os arquivos do storage só depois', async () => {
            const prisma = coursePrisma();
            const mediaService = media();
            const order: string[] = [];
            prisma.event.delete.mockImplementation(async () => void order.push('db'));
            mediaService.deleteObject.mockImplementation(async (key: string) => void order.push(key));

            await build(prisma, mediaService).purge('courses', 'c1', ORG);

            expect(prisma.event.delete).toHaveBeenCalledWith({ where: { id: 'e1', hardDelete: true } });
            expect(order[0]).toBe('db');
            expect(mediaService.deleteObject).toHaveBeenCalledTimes(3);
        });

        it('se o banco recusar (FK), nenhum arquivo é apagado e o erro vira 409', async () => {
            const prisma = coursePrisma();
            const mediaService = media();
            prisma.event.delete.mockRejectedValue(new Prisma.PrismaClientKnownRequestError('fk', { code: 'P2003', clientVersion: 'x' }));

            await expect(build(prisma, mediaService).purge('courses', 'c1', ORG)).rejects.toBeInstanceOf(ConflictException);
            expect(mediaService.deleteObject).not.toHaveBeenCalled();
        });

        it('item fora da lixeira → 404 e nada é apagado', async () => {
            const prisma = buildPrisma();
            prisma.roleAssignment.findFirst.mockResolvedValue(null);
            await expect(build(prisma).purge('roles', 'r1', ORG)).rejects.toBeInstanceOf(NotFoundException);
            expect(prisma.roleAssignment.delete).not.toHaveBeenCalled();
        });

        it('pessoa e cargo: exclusão física com a flag hardDelete', async () => {
            const prisma = buildPrisma();
            prisma.user.findFirst.mockResolvedValue({ id: 'u1', name: 'Maria' });
            prisma.user.delete.mockResolvedValue({});
            prisma.roleAssignment.findFirst.mockResolvedValue({ id: 'r1', name: 'Secretaria' });
            prisma.roleAssignment.delete.mockResolvedValue({});
            const service = build(prisma);

            await service.purge('people', 'u1', ORG);
            await service.purge('roles', 'r1', ORG);

            expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: 'u1', hardDelete: true } });
            expect(prisma.roleAssignment.delete).toHaveBeenCalledWith({ where: { id: 'r1', hardDelete: true } });
            expect(prisma.user.findFirst.mock.calls[0][0].where.role).toEqual({ in: [Role.ORG_ADMIN, Role.ORG_USER] });
        });

        it('evento: coleta arquivos de anexos, ocorrências, plantas e planta legada', async () => {
            const prisma = buildPrisma();
            prisma.event.findFirst.mockResolvedValue({ id: 'e1', title: 'Congresso', meeting: null });
            for (const m of ['eventFile', 'occurrenceReport', 'occurrenceReportFile', 'eventShift', 'designation', 'eventFloorPlan']) prisma[m].count.mockResolvedValue(1);
            prisma.eventFile.findMany.mockResolvedValue([{ storageKey: 'ev/a.pdf' }]);
            prisma.occurrenceReportFile.findMany.mockResolvedValue([{ storageKey: 'oc/b.jpg' }]);
            prisma.eventFloorPlan.findMany.mockResolvedValue([{ imageKey: 'fp/c.png' }]);
            prisma.eventOperation.findUnique.mockResolvedValue({ floorPlanKey: 'fp/legado.png' });

            const check = await build(prisma).purgeCheck('events', 'e1', ORG);
            expect(check.files).toBe(4);
        });
    });
});

describe('cascadeSoftDelete', () => {
    const now = new Date('2026-10-01T00:00:00.000Z');

    it('Event → Course → Enrollment: propaga em todos os níveis com o mesmo carimbo', async () => {
        const client: any = {
            Course: { findMany: jest.fn().mockResolvedValue([{ id: 'c1' }]), updateMany: jest.fn() },
            Enrollment: { updateMany: jest.fn() },
        };

        await cascadeSoftDelete(client, 'Event', ['e1'], now);

        expect(client.Course.findMany).toHaveBeenCalledWith({ where: { eventId: { in: ['e1'] }, deletedAt: null }, select: { id: true } });
        expect(client.Course.updateMany).toHaveBeenCalledWith({ where: { id: { in: ['c1'] } }, data: { deletedAt: now } });
        expect(client.Enrollment.updateMany).toHaveBeenCalledWith({ where: { courseId: { in: ['c1'] }, deletedAt: null }, data: { deletedAt: now } });
    });

    it('sem filhos vivos, não toca nos netos', async () => {
        const client: any = {
            Course: { findMany: jest.fn().mockResolvedValue([]), updateMany: jest.fn() },
            Enrollment: { updateMany: jest.fn() },
        };
        await cascadeSoftDelete(client, 'Event', ['e1'], now);
        expect(client.Enrollment.updateMany).not.toHaveBeenCalled();
    });

    it('modelo sem filhos mapeados não faz nada', async () => {
        const client: any = {};
        await expect(cascadeSoftDelete(client, 'RoleAssignment', ['r1'], now)).resolves.toBeUndefined();
    });
});
