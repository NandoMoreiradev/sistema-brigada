// frontend/src/services/schedule.ts
// Cliente da programação da turma (backend/src/courses/course-schedule.*) e das equipes de
// instrutores (backend/src/courses/teams.*).

import { api } from './api';
import type { Room } from '@/types';

export type ScheduleActivityKind = 'ACTIVITY' | 'BREAK' | 'MEAL';

export const KIND_LABEL: Record<ScheduleActivityKind, string> = {
    ACTIVITY: 'Atividade',
    BREAK: 'Intervalo',
    MEAL: 'Refeição',
};

export interface Team {
    id: string;
    name: string;
    active: boolean;
    members: { userId: string; user: { id: string; name: string } }[];
}

export interface CourseGroup {
    id: string;
    courseId: string;
    name: string;
    roomId: string | null;
    room: Room | null;
    order: number;
    _count: { enrollments: number };
}

/** Responsável pela atividade: uma equipe OU uma pessoa. */
export interface ActivityAssignee {
    id: string;
    teamId: string | null;
    userId: string | null;
    team: Team | null;
    user: { id: string; name: string } | null;
}

export interface CourseActivity {
    id: string;
    title: string;
    kind: ScheduleActivityKind;
    durationMinutes: number;
    /** Local fixo; vazio = sala base do grupo. */
    roomId: string | null;
    room: Room | null;
    order: number;
    assignees: ActivityAssignee[];
}

export interface ScheduleBlock {
    id: string;
    groupId: string | null;
    date: string;
    order: number;
    activityId: string;
    startTime: string;
    endTime: string;
}

export interface ScheduleConflict {
    type: 'ROOM' | 'PERSON';
    date: string;
    message: string;
    blockIds: string[];
}

export interface CourseSchedule {
    groups: CourseGroup[];
    activities: CourseActivity[];
    blocks: ScheduleBlock[];
    conflicts: ScheduleConflict[];
}

export interface ActivityInput {
    title: string;
    kind: ScheduleActivityKind;
    durationMinutes: number;
    roomId: string | null;
    assignees: { teamId?: string; userId?: string }[];
}

export interface ScheduleTemplateSummary {
    id: string;
    name: string;
    updatedAt: string;
    groups: number;
    activities: number;
    days: number;
}

export const courseScheduleApi = {
    get: async (courseId: string) => {
        const { data } = await api.get<CourseSchedule>(`/courses/${courseId}/schedule`);
        return data;
    },
    /** Substitui a programação de um grupo num dia. Lista vazia apaga. */
    saveDay: async (courseId: string, input: { groupId: string | null; date: string; startTime: string; activityIds: string[] }) => {
        await api.put(`/courses/${courseId}/schedule/day`, input);
    },
    createGroup: async (courseId: string, input: { name: string; roomId?: string }) => {
        const { data } = await api.post<CourseGroup>(`/courses/${courseId}/groups`, input);
        return data;
    },
    updateGroup: async (courseId: string, groupId: string, input: { name?: string; roomId?: string | null }) => {
        const { data } = await api.patch<CourseGroup>(`/courses/${courseId}/groups/${groupId}`, input);
        return data;
    },
    removeGroup: async (courseId: string, groupId: string) => {
        await api.delete(`/courses/${courseId}/groups/${groupId}`);
    },
    assignGroups: async (courseId: string, assignments: { enrollmentId: string; groupId: string | null }[]) => {
        await api.put(`/courses/${courseId}/groups/assignments`, { assignments });
    },
    createActivity: async (courseId: string, input: ActivityInput) => {
        const { data } = await api.post<CourseActivity>(`/courses/${courseId}/activities`, input);
        return data;
    },
    updateActivity: async (courseId: string, activityId: string, input: Partial<ActivityInput>) => {
        const { data } = await api.patch<CourseActivity>(`/courses/${courseId}/activities/${activityId}`, input);
        return data;
    },
    removeActivity: async (courseId: string, activityId: string) => {
        await api.delete(`/courses/${courseId}/activities/${activityId}`);
    },
    saveTemplate: async (courseId: string, name: string) => {
        const { data } = await api.post<ScheduleTemplateSummary>(`/courses/${courseId}/schedule/template`, { name });
        return data;
    },
    applyTemplate: async (courseId: string, templateId: string, startDate: string) => {
        await api.post(`/courses/${courseId}/schedule/apply-template`, { templateId, startDate });
    },
};

export const scheduleTemplatesApi = {
    list: async () => {
        const { data } = await api.get<ScheduleTemplateSummary[]>('/schedule-templates');
        return data;
    },
    remove: async (id: string) => {
        await api.delete(`/schedule-templates/${id}`);
    },
};

export const teamsApi = {
    list: async () => {
        const { data } = await api.get<Team[]>('/teams');
        return data;
    },
    create: async (input: { name: string; memberIds: string[] }) => {
        const { data } = await api.post<Team>('/teams', input);
        return data;
    },
    /** Sem exclusão: "remover" é `active: false`. */
    update: async (id: string, input: { name?: string; memberIds?: string[]; active?: boolean }) => {
        const { data } = await api.patch<Team>(`/teams/${id}`, input);
        return data;
    },
};
