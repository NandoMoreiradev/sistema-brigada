import { ConflictException } from '@nestjs/common';
import { EventShiftsService } from './event-shifts.service';

const ORG = 'org-1';

/** Turno de 20/10 08:00–12:00 (Brasília) com uma pessoa escalada cujo certificado vence em `certExpiresAt`. */
function build(certExpiresAt: Date) {
    const shift = { id: 's1', start: new Date('2026-10-20T08:00:00-03:00'), end: new Date('2026-10-20T12:00:00-03:00') };
    const tx = {
        eventShift: { update: jest.fn().mockResolvedValue({ id: 's1' }) },
        designation: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    };
    const prisma = {
        eventShift: { findFirst: jest.fn().mockResolvedValue(shift) },
        designation: {
            findMany: jest.fn().mockResolvedValue([{ id: 'd1', staffMemberId: 'sm1', staffMember: { userId: 'u1', user: { name: 'Ana' } } }]),
            findFirst: jest.fn().mockResolvedValue(null), // sem conflito com outro evento
        },
        externalCertification: { findMany: jest.fn().mockResolvedValue([]) },
        certificate: { findMany: jest.fn().mockResolvedValue([{ expiresAt: certExpiresAt }]) },
        $transaction: jest.fn(async (fn: (client: typeof tx) => unknown) => fn(tx)),
    };
    const events = { requireEventOperation: jest.fn().mockResolvedValue({ id: 'op1' }) };
    return { service: new EventShiftsService(prisma as never, events as never), prisma, tx };
}

describe('EventShiftsService.update — validade do certificado ao remarcar', () => {
    it('remarcar para depois do vencimento do certificado de quem está escalado é recusado', async () => {
        const { service, tx } = build(new Date('2026-10-22T10:00:00-03:00'));

        await expect(service.update('e1', ORG, 's1', { start: '2026-10-25T08:00', end: '2026-10-25T12:00' })).rejects.toBeInstanceOf(ConflictException);
        expect(tx.eventShift.update).not.toHaveBeenCalled();
    });

    it('remarcar para um dia em que o certificado ainda vale funciona', async () => {
        const { service, tx } = build(new Date('2026-10-30T10:00:00-03:00'));

        await service.update('e1', ORG, 's1', { start: '2026-10-25T08:00', end: '2026-10-25T12:00' });

        expect(tx.eventShift.update).toHaveBeenCalled();
    });

    it('remarcar para mais cedo não revalida certificado (só melhora)', async () => {
        const { service, prisma, tx } = build(new Date('2026-01-01T10:00:00-03:00')); // já vencido

        await service.update('e1', ORG, 's1', { start: '2026-10-19T08:00', end: '2026-10-19T12:00' });

        expect(prisma.certificate.findMany).not.toHaveBeenCalled();
        expect(tx.eventShift.update).toHaveBeenCalled();
    });

    it('só renomear o turno não revalida nada', async () => {
        const { service, prisma } = build(new Date('2026-01-01T10:00:00-03:00'));

        await service.update('e1', ORG, 's1', { name: 'Manhã A' });

        expect(prisma.certificate.findMany).not.toHaveBeenCalled();
    });
});
