import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { CourseCopyService } from './course-copy.service';

const ORG = 'org-1';
const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

function buildPrisma() {
    const model = (methods: string[]) => Object.fromEntries(methods.map((m) => [m, jest.fn()]));
    const prisma: any = {
        course: model(['findFirst']),
        classSession: model(['count', 'findFirst', 'findMany', 'create']),
        courseGroup: model(['count', 'findMany']),
        courseActivity: model(['count']),
        scheduleBlock: model(['findMany', 'findFirst']),
        courseModule: model(['count', 'findMany', 'aggregate', 'create']),
        courseLesson: model(['count']),
        courseLessonVideo: model(['count']),
        courseLessonFile: model(['count']),
        room: model(['findMany']),
        $transaction: jest.fn((fn: (tx: unknown) => unknown) => fn(prisma)),
    };
    prisma.course.findFirst.mockImplementation(async ({ where }: any) => ({ id: where.id, event: { title: `Turma ${where.id}` } }));
    for (const m of ['count']) {
        prisma.classSession[m].mockResolvedValue(0);
        prisma.courseGroup[m].mockResolvedValue(0);
        prisma.courseActivity[m].mockResolvedValue(0);
        prisma.courseModule[m].mockResolvedValue(0);
        prisma.courseLesson[m].mockResolvedValue(0);
        prisma.courseLessonVideo[m].mockResolvedValue(0);
        prisma.courseLessonFile[m].mockResolvedValue(0);
    }
    prisma.classSession.findFirst.mockResolvedValue(null);
    prisma.classSession.findMany.mockResolvedValue([]);
    prisma.scheduleBlock.findMany.mockResolvedValue([]);
    prisma.scheduleBlock.findFirst.mockResolvedValue(null);
    prisma.courseGroup.findMany.mockResolvedValue([]);
    prisma.courseModule.findMany.mockResolvedValue([]);
    prisma.courseModule.aggregate.mockResolvedValue({ _max: { order: null } });
    prisma.room.findMany.mockResolvedValue([{ id: 'room-1' }]);
    return prisma;
}

/** `findFirst` serve a duas perguntas: a 1ª data da origem (sem `roomId`) e o conflito de sala (com `roomId`). */
function sessionLookups(prisma: any, firstDate: Date | null, clash: unknown = null) {
    prisma.classSession.findFirst.mockImplementation(async ({ where }: any) => (where.roomId ? clash : firstDate ? { date: firstDate } : null));
}

const schedule = () => ({ buildTemplateData: jest.fn(), applyTemplateData: jest.fn().mockResolvedValue(undefined) });
const build = (prisma: any, scheduleService = schedule()) => new CourseCopyService(prisma, scheduleService as any);
const dto = (extra: Partial<Parameters<CourseCopyService['copy']>[2]> = {}) => ({
    sourceCourseId: 'src',
    startDate: '2027-03-10',
    sessions: false,
    schedule: false,
    lessons: false,
    ...extra,
});

const session = (extra: Record<string, unknown> = {}) => ({
    date: d('2026-10-05'),
    startTime: '08:00',
    endTime: '12:00',
    roomId: 'room-1',
    topic: 'RCP',
    group: null,
    ...extra,
});

describe('CourseCopyService', () => {
    describe('validações', () => {
        it('recusa copiar a turma para ela mesma', async () => {
            await expect(build(buildPrisma()).copy('dst', ORG, dto({ sourceCourseId: 'dst', lessons: true }), 'u1')).rejects.toBeInstanceOf(BadRequestException);
        });

        it('exige escolher ao menos uma coisa', async () => {
            await expect(build(buildPrisma()).copy('dst', ORG, dto(), 'u1')).rejects.toThrow('Escolha o que copiar');
        });

        it('turma de origem de outra academia → 404', async () => {
            const prisma = buildPrisma();
            prisma.course.findFirst.mockImplementation(async ({ where }: any) => (where.id === 'src' ? null : { id: where.id, event: { title: 'x' } }));
            await expect(build(prisma).copy('dst', ORG, dto({ lessons: true }), 'u1')).rejects.toBeInstanceOf(NotFoundException);
        });

        it('com datas a copiar, exige o primeiro dia da turma nova', async () => {
            const prisma = buildPrisma();
            sessionLookups(prisma, d('2026-10-05'));
            await expect(build(prisma).copy('dst', ORG, dto({ sessions: true, startDate: undefined }), 'u1')).rejects.toThrow('primeiro dia');
        });

        it('só vídeo-aulas: não pede data', async () => {
            const prisma = buildPrisma();
            const result = await build(prisma).copy('dst', ORG, dto({ lessons: true, startDate: undefined }), 'u1');
            expect(result.lessons).toEqual({ modules: 0, lessons: 0 });
        });
    });

    describe('agenda', () => {
        it('desloca as datas pelo mesmo intervalo, mantendo a distância entre as aulas', async () => {
            const prisma = buildPrisma();
            sessionLookups(prisma, d('2026-10-05'));
            prisma.classSession.findMany.mockResolvedValue([session(), session({ date: d('2026-10-07'), startTime: '13:00', endTime: '17:00', roomId: null })]);

            const result = await build(prisma).copy('dst', ORG, dto({ sessions: true }), 'u1');

            const created = prisma.classSession.create.mock.calls.map(([arg]: any) => arg.data);
            expect(created.map((c: any) => c.date)).toEqual([d('2027-03-10'), d('2027-03-12')]);
            expect(created[0]).toMatchObject({ courseId: 'dst', startTime: '08:00', endTime: '12:00', roomId: 'room-1', topic: 'RCP', groupId: null });
            expect(result.sessions).toEqual({ copied: 2, skipped: 0 });
            expect(result.warnings).toEqual([]);
        });

        it('aula de grupo é ligada ao grupo de mesmo nome da turma nova; sem ele, é pulada com aviso', async () => {
            const prisma = buildPrisma();
            sessionLookups(prisma, d('2026-10-05'));
            prisma.classSession.findMany.mockResolvedValue([session({ group: { name: 'Sala 1' } }), session({ group: { name: 'Sala 9' } })]);
            prisma.courseGroup.findMany.mockResolvedValue([{ id: 'g-new', name: 'Sala 1' }]);

            const result = await build(prisma).copy('dst', ORG, dto({ sessions: true }), 'u1');

            expect(prisma.classSession.create).toHaveBeenCalledTimes(1);
            expect(prisma.classSession.create.mock.calls[0][0].data.groupId).toBe('g-new');
            expect(result.sessions).toEqual({ copied: 1, skipped: 1 });
            expect(result.warnings[0]).toContain('Sala 9');
        });

        it('sala desativada ou ocupada: copia a aula sem sala e avisa', async () => {
            const prisma = buildPrisma();
            sessionLookups(prisma, d('2026-10-05'), { startTime: '09:00', room: { name: 'Sala 1' } });
            prisma.classSession.findMany.mockResolvedValue([session(), session({ roomId: 'room-off', startTime: '14:00', endTime: '15:00' })]);

            const result = await build(prisma).copy('dst', ORG, dto({ sessions: true }), 'u1');

            const created = prisma.classSession.create.mock.calls.map(([arg]: any) => arg.data);
            expect(created.map((c: any) => c.roomId)).toEqual([null, null]);
            expect(result.sessions.copied).toBe(2);
            expect(result.warnings).toHaveLength(2);
            expect(result.warnings[0]).toContain('ocupada');
            expect(result.warnings[1]).toContain('desativada');
        });
    });

    describe('programação', () => {
        it('aplica a programação da origem deslocada, com o 1º dia em startDate quando ela é a primeira data', async () => {
            const prisma = buildPrisma();
            prisma.courseActivity.count.mockResolvedValue(3);
            prisma.scheduleBlock.findFirst.mockResolvedValue({ date: d('2026-10-05') });
            prisma.scheduleBlock.findMany.mockResolvedValue([{ groupId: null, date: d('2026-10-05') }]);
            const scheduleService = schedule();
            const data = { version: 1, groups: [{ key: 'g', name: 'A', roomId: null }], activities: [{ key: 'a' }, { key: 'b' }], days: [] };
            scheduleService.buildTemplateData = jest.fn().mockResolvedValue({ data, firstDate: d('2026-10-05') });

            const result = await build(prisma, scheduleService).copy('dst', ORG, dto({ schedule: true }), 'u1');

            expect(scheduleService.applyTemplateData).toHaveBeenCalledWith('dst', ORG, data, d('2027-03-10'));
            expect(result.schedule).toEqual({ groups: 1, activities: 2, days: 1 });
        });

        it('com agenda e programação juntas, os dois deslocam igual (a primeira data de todas vira startDate)', async () => {
            const prisma = buildPrisma();
            prisma.courseActivity.count.mockResolvedValue(1);
            sessionLookups(prisma, d('2026-10-01'));
            prisma.scheduleBlock.findFirst.mockResolvedValue({ date: d('2026-10-05') });
            const scheduleService = schedule();
            scheduleService.buildTemplateData = jest.fn().mockResolvedValue({ data: { groups: [], activities: [{}], days: [] }, firstDate: d('2026-10-05') });

            await build(prisma, scheduleService).copy('dst', ORG, dto({ schedule: true, sessions: true }), 'u1');

            expect(scheduleService.applyTemplateData.mock.calls[0][3]).toEqual(d('2027-03-14'));
        });

        it('turma de destino com atividades: a recusa da programação vem antes de gravar aulas ou vídeo-aulas', async () => {
            const prisma = buildPrisma();
            prisma.courseActivity.count.mockResolvedValue(2);
            prisma.scheduleBlock.findFirst.mockResolvedValue({ date: d('2026-10-05') });
            const scheduleService = schedule();
            scheduleService.buildTemplateData = jest.fn().mockResolvedValue({ data: { groups: [], activities: [{}], days: [] }, firstDate: d('2026-10-05') });
            scheduleService.applyTemplateData.mockRejectedValue(new ConflictException('já tem atividades'));

            await expect(build(prisma, scheduleService).copy('dst', ORG, dto({ schedule: true, lessons: true }), 'u1')).rejects.toBeInstanceOf(ConflictException);
            expect(prisma.$transaction).not.toHaveBeenCalled();
            expect(prisma.courseModule.create).not.toHaveBeenCalled();
        });
    });

    describe('vídeo-aulas', () => {
        it('copia módulos, aulas, vídeos e materiais depois do que a turma nova já tem, sem levar o progresso', async () => {
            const prisma = buildPrisma();
            prisma.courseModule.aggregate.mockResolvedValue({ _max: { order: 1 } });
            prisma.courseModule.findMany.mockResolvedValue([
                {
                    title: 'Módulo 1',
                    active: true,
                    lessons: [
                        {
                            title: 'Aula 1',
                            content: 'texto',
                            duration: 30,
                            order: 0,
                            active: true,
                            videos: [{ title: 'v', url: 'https://cdn/x.mp4', storageKey: 'course-lessons/org/x.mp4', order: 0 }],
                            files: [{ name: 'apostila.pdf', storageKey: 'k', externalUrl: 'https://cdn/k', mimeType: 'application/pdf', size: 10 }],
                        },
                    ],
                },
                { title: 'Módulo 2', active: false, lessons: [] },
            ]);

            const result = await build(prisma).copy('dst', ORG, dto({ lessons: true }), 'u-copy');

            const [first, second] = prisma.courseModule.create.mock.calls.map(([arg]: any) => arg.data);
            expect(first).toMatchObject({ courseId: 'dst', title: 'Módulo 1', order: 2, active: true });
            expect(second).toMatchObject({ title: 'Módulo 2', order: 3, active: false });
            const lesson = first.lessons.create[0];
            expect(lesson).toMatchObject({ title: 'Aula 1', content: 'texto', duration: 30 });
            expect(lesson.videos.create[0]).toEqual({ title: 'v', url: 'https://cdn/x.mp4', storageKey: 'course-lessons/org/x.mp4', order: 0 });
            expect(lesson.files.create[0]).toMatchObject({ name: 'apostila.pdf', storageKey: 'k', uploadedByUserId: 'u-copy' });
            expect(lesson).not.toHaveProperty('progress');
            expect(result.lessons).toEqual({ modules: 2, lessons: 1 });
        });
    });

    describe('preview', () => {
        it('resume a origem, a primeira data e o que o destino já tem', async () => {
            const prisma = buildPrisma();
            prisma.classSession.count.mockResolvedValueOnce(4).mockResolvedValueOnce(1);
            prisma.courseGroup.count.mockResolvedValue(3);
            prisma.courseActivity.count.mockResolvedValueOnce(20).mockResolvedValueOnce(0);
            prisma.scheduleBlock.findMany.mockResolvedValue([
                { groupId: 'a', date: d('2026-10-05') },
                { groupId: 'b', date: d('2026-10-05') },
            ]);
            prisma.courseModule.count.mockResolvedValueOnce(2).mockResolvedValueOnce(0);
            prisma.courseLesson.count.mockResolvedValue(7);
            prisma.courseLessonVideo.count.mockResolvedValue(9);
            prisma.courseLessonFile.count.mockResolvedValue(2);
            sessionLookups(prisma, d('2026-10-08'));
            prisma.scheduleBlock.findFirst.mockResolvedValue({ date: d('2026-10-05') });

            const preview = await build(prisma).preview('dst', 'src', ORG);

            expect(preview.source).toEqual({
                title: 'Turma src',
                sessions: 4,
                groups: 3,
                activities: 20,
                scheduleDays: 2,
                modules: 2,
                lessons: 7,
                videos: 9,
                files: 2,
                firstDate: '2026-10-05',
            });
            expect(preview.target).toEqual({ sessions: 1, activities: 0, modules: 0 });
        });
    });
});
