import { ConflictException } from '@nestjs/common';
import { assertQualifiedForShift, expiryDayNumber, qualificationCoversShift } from './qualification-validity.util';

// Horários em Brasília (UTC-3, sem horário de verão): 08:00 BRT = 11:00Z.
const shift = (startBrt: string, endBrt: string) => ({ start: new Date(`${startBrt}-03:00`), end: new Date(`${endBrt}-03:00`) });
const MORNING_20 = shift('2026-10-20T08:00:00', '2026-10-20T12:00:00');

describe('qualificationCoversShift', () => {
    it('sem vencimento sempre vale', () => {
        expect(qualificationCoversShift(null, MORNING_20)).toBe(true);
    });

    it('vencimento no dia do turno ainda vale, mesmo que a hora já tenha passado (dia de calendário)', () => {
        // Vence 20/10 às 06:00 BRT, o turno é 20/10 08:00–12:00: a data que a pessoa vê é 20/10.
        expect(qualificationCoversShift(new Date('2026-10-20T06:00:00-03:00'), MORNING_20)).toBe(true);
        expect(qualificationCoversShift(new Date('2026-10-20T23:00:00-03:00'), MORNING_20)).toBe(true);
    });

    it('vencimento no dia anterior ao turno não vale', () => {
        expect(qualificationCoversShift(new Date('2026-10-19T23:59:00-03:00'), MORNING_20)).toBe(false);
    });

    it('certificação externa (só data, meia-noite UTC) vale no próprio dia — não "vence um dia antes"', () => {
        const external = new Date('2026-10-20T00:00:00.000Z');
        expect(expiryDayNumber(external)).toBe(expiryDayNumber(new Date('2026-10-20T12:00:00-03:00')));
        expect(qualificationCoversShift(external, MORNING_20)).toBe(true);
        expect(qualificationCoversShift(external, shift('2026-10-21T08:00:00', '2026-10-21T12:00:00'))).toBe(false);
    });

    it('turno que atravessa a meia-noite exige validade até o dia em que termina', () => {
        const night = shift('2026-10-20T22:00:00', '2026-10-21T02:00:00');
        expect(qualificationCoversShift(new Date('2026-10-20T10:00:00-03:00'), night)).toBe(false);
        expect(qualificationCoversShift(new Date('2026-10-21T10:00:00-03:00'), night)).toBe(true);
    });

    it('turno que termina exatamente à meia-noite não puxa o dia seguinte', () => {
        const evening = shift('2026-10-20T18:00:00', '2026-10-21T00:00:00');
        expect(qualificationCoversShift(new Date('2026-10-20T10:00:00-03:00'), evening)).toBe(true);
    });
});

describe('assertQualifiedForShift', () => {
    const person = { userId: 'u1', name: 'Ana' };

    function build(external: (Date | null)[], courses: (Date | null)[]) {
        return {
            externalCertification: { findMany: jest.fn().mockResolvedValue(external.map((expiresAt) => ({ expiresAt }))) },
            certificate: { findMany: jest.fn().mockResolvedValue(courses.map((expiresAt) => ({ expiresAt }))) },
        };
    }

    it('quem nunca teve certificado nem certificação não é bloqueado', async () => {
        await expect(assertQualifiedForShift(build([], []) as never, person, MORNING_20)).resolves.toBeUndefined();
    });

    it('certificado que vence DEPOIS do turno libera', async () => {
        const prisma = build([], [new Date('2026-12-01T10:00:00-03:00')]);
        await expect(assertQualifiedForShift(prisma as never, person, MORNING_20)).resolves.toBeUndefined();
    });

    it('certificado válido hoje, mas que vence ANTES do turno, bloqueia e diz as datas', async () => {
        const prisma = build([], [new Date('2026-10-10T10:00:00-03:00')]);

        const error = await assertQualifiedForShift(prisma as never, person, MORNING_20).catch((e: unknown) => e);

        expect(error).toBeInstanceOf(ConflictException);
        expect((error as ConflictException).message).toContain('Ana');
        expect((error as ConflictException).message).toContain('vence em 10/10/2026');
        expect((error as ConflictException).message).toContain('turno de 20/10/2026');
    });

    it('uma qualificação vencida não bloqueia se outra (ex.: certificação externa) cobre o turno', async () => {
        const prisma = build([new Date('2027-03-01T00:00:00.000Z')], [new Date('2026-01-01T10:00:00-03:00')]);
        await expect(assertQualifiedForShift(prisma as never, person, MORNING_20)).resolves.toBeUndefined();
    });

    it('um certificado sem vencimento cobre qualquer turno, mesmo com outro vencido', async () => {
        const prisma = build([], [new Date('2026-01-01T10:00:00-03:00'), null]);
        await expect(assertQualifiedForShift(prisma as never, person, MORNING_20)).resolves.toBeUndefined();
    });

    it('na mensagem usa o vencimento mais tardio entre as qualificações', async () => {
        const prisma = build([new Date('2026-02-01T00:00:00.000Z')], [new Date('2026-09-15T10:00:00-03:00')]);

        const error = (await assertQualifiedForShift(prisma as never, person, MORNING_20).catch((e: unknown) => e)) as ConflictException;

        expect(error.message).toContain('vence em 15/09/2026');
    });

    it('ignora certificados revogados na consulta', async () => {
        const prisma = build([], []);
        await assertQualifiedForShift(prisma as never, person, MORNING_20);
        expect(prisma.certificate.findMany.mock.calls[0][0].where.status).toEqual({ not: 'REVOKED' });
    });
});
