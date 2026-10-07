import { dueStage, upcomingStages, daysUntilExpiration, stageLabel, AFTER_STAGE_CATCH_UP_DAYS } from './certificate-reminder-schedule';

const schedule = { daysBefore: [60, 30, 7], daysAfter: [7, 30] };

describe('dueStage', () => {
    it('vale a etapa "antes" mais recente já alcançada', () => {
        expect(dueStage(90, schedule)).toBeNull();
        expect(dueStage(60, schedule)).toBe('before:60');
        expect(dueStage(45, schedule)).toBe('before:60');
        expect(dueStage(25, schedule)).toBe('before:30');
        expect(dueStage(7, schedule)).toBe('before:7');
        expect(dueStage(0, schedule)).toBe('before:7');
    });

    it('"no dia" é a etapa 0', () => {
        expect(dueStage(0, { daysBefore: [30, 0], daysAfter: [] })).toBe('before:0');
        expect(dueStage(1, { daysBefore: [30, 0], daysAfter: [] })).toBe('before:30');
    });

    it('depois de vencer, vale a etapa "depois" mais recente, com atraso limitado', () => {
        expect(dueStage(-1, schedule)).toBeNull();
        expect(dueStage(-7, schedule)).toBe('after:7');
        expect(dueStage(-(7 + AFTER_STAGE_CATCH_UP_DAYS), schedule)).toBe('after:7');
        expect(dueStage(-(7 + AFTER_STAGE_CATCH_UP_DAYS + 1), schedule)).toBeNull();
        expect(dueStage(-30, schedule)).toBe('after:30');
        // vencido há anos: ligar "7 dias depois" não dispara nada
        expect(dueStage(-800, schedule)).toBeNull();
    });

    it('sem etapas, nada é devido', () => {
        expect(dueStage(10, { daysBefore: [], daysAfter: [] })).toBeNull();
        expect(dueStage(-10, { daysBefore: [], daysAfter: [] })).toBeNull();
    });
});

describe('upcomingStages', () => {
    it('simula os próximos dias sem repetir etapa já enviada', () => {
        expect(upcomingStages(35, schedule, new Set(['before:60']), 30)).toEqual([
            { dayOffset: 5, stage: 'before:30' },
            { dayOffset: 28, stage: 'before:7' },
        ]);
    });

    it('etapa alcançada e não enviada sai hoje', () => {
        expect(upcomingStages(25, schedule, new Set(), 3)).toEqual([{ dayOffset: 0, stage: 'before:30' }]);
    });
});

describe('daysUntilExpiration', () => {
    it('conta dias de calendário no fuso de Brasília', () => {
        // 23h de Brasília do dia 10 (02h UTC do dia 11) até 01h de Brasília do dia 11: 1 dia, não 0.
        expect(daysUntilExpiration(new Date('2026-03-11T04:00:00Z'), new Date('2026-03-11T02:00:00Z'))).toBe(1);
        expect(daysUntilExpiration(new Date('2026-03-10T12:00:00Z'), new Date('2026-03-11T12:00:00Z'))).toBe(-1);
    });
});

describe('stageLabel', () => {
    it('descreve as etapas', () => {
        expect(stageLabel('before:30')).toBe('30 dias antes');
        expect(stageLabel('before:0')).toBe('No dia do vencimento');
        expect(stageLabel('after:1')).toBe('1 dia depois de vencer');
        expect(stageLabel('manual:1700000000000')).toBe('Envio manual');
    });
});
