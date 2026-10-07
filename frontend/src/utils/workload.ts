// frontend/src/utils/workload.ts
//
// Sugestão de carga horária da turma a partir das aulas lançadas: soma as aulas da
// turma inteira e, quando ela é dividida em grupos, as do grupo com mais horas (cada
// aluno faz as aulas de UM grupo). É só sugestão — a carga horária do certificado é
// a que a academia digitar.

import type { ClassSession } from '@/types';

const minutesOf = (time: string) => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
};

const durationMinutes = (session: Pick<ClassSession, 'startTime' | 'endTime'>) =>
    Math.max(0, minutesOf(session.endTime) - minutesOf(session.startTime));

/** Horas inteiras (arredondadas), ou null se não há aula com horário. */
export function suggestWorkloadHours(sessions: Array<Pick<ClassSession, 'startTime' | 'endTime' | 'groupId'>>): number | null {
    let wholeClass = 0;
    const byGroup = new Map<string, number>();
    for (const session of sessions) {
        const minutes = durationMinutes(session);
        if (session.groupId) byGroup.set(session.groupId, (byGroup.get(session.groupId) ?? 0) + minutes);
        else wholeClass += minutes;
    }
    const total = wholeClass + Math.max(0, ...byGroup.values());
    return total > 0 ? Math.round(total / 60) : null;
}
