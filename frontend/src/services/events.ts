// frontend/src/services/events.ts
// Cliente da API de eventos polimórficos (backend/src/events).

import { api } from './api';
import type { AttendanceStatus, EventStatus, Paginated } from '@/types';

export type EventKind = 'ASSEMBLEIA' | 'CONGRESSO' | 'REUNIAO';
export type DesignationStatus = 'PENDING' | 'CONFIRMED' | 'DECLINED';

export interface EventPost {
    id: string;
    name: string;
    capacity: number | null;
    notes: string | null;
    posX: number | null;
    posY: number | null;
}

export interface Team {
    id: string;
    name: string;
}

export interface EventOperation {
    id: string;
    estimatedAudienceCount: number | null;
    notes: string | null;
    floorPlanKey: string | null;
    floorPlanUrl: string | null;
    posts: EventPost[];
    _count: { designations: number; occurrenceReports: number };
}

export interface Meeting {
    id: string;
    agenda: string | null;
    minutes: string | null;
    meetUrl: string | null;
    _count: { attendances: number };
}

export interface AppEvent {
    id: string;
    kind: EventKind;
    title: string;
    location: string | null;
    startDate: string;
    endDate: string | null;
    status: EventStatus;
    operation: EventOperation | null;
    meeting: Meeting | null;
    _count: { files: number };
}

export interface CreateEventInput {
    kind: EventKind;
    title: string;
    location?: string;
    startDate: string;
    endDate?: string;
    estimatedAudienceCount?: number;
    notes?: string;
    agenda?: string;
}

export const eventsApi = {
    list: async (kind?: EventKind) => {
        const { data } = await api.get<Paginated<AppEvent>>('/events', { params: { kind, limit: 100 } });
        return data;
    },
    get: async (id: string) => {
        const { data } = await api.get<AppEvent>(`/events/${id}`);
        return data;
    },
    create: async (input: CreateEventInput) => {
        const { data } = await api.post<AppEvent>('/events', input);
        return data;
    },
    update: async (id: string, input: Partial<CreateEventInput> & { status?: EventStatus }) => {
        const { data } = await api.patch<AppEvent>(`/events/${id}`, input);
        return data;
    },
    remove: async (id: string) => {
        await api.delete(`/events/${id}`);
    },
};

export interface Designation {
    id: string;
    role: string;
    shiftStart: string;
    shiftEnd: string;
    status: DesignationStatus;
    staffMember: { id: string; user: { id: string; name: string; email: string } };
    post: EventPost | null;
    team: Team | null;
}

export const designationsApi = {
    list: async (eventId: string) => {
        const { data } = await api.get<Designation[]>(`/events/${eventId}/designations`);
        return data;
    },
    create: async (eventId: string, input: { staffMemberId: string; role: string; shiftStart: string; shiftEnd: string; postId?: string }) => {
        const { data } = await api.post<Designation>(`/events/${eventId}/designations`, input);
        return data;
    },
    createBulk: async (
        eventId: string,
        input: {
            staffMemberIds: string[];
            role: string;
            shiftStart: string;
            shiftEnd: string;
            postId?: string;
            asTeam?: boolean;
            teamName?: string;
        },
    ) => {
        const { data } = await api.post<Designation[]>(`/events/${eventId}/designations/bulk`, input);
        return data;
    },
    update: async (
        eventId: string,
        designationId: string,
        input: Partial<{ staffMemberId: string; role: string; shiftStart: string; shiftEnd: string; postId: string }>,
    ) => {
        const { data } = await api.patch<Designation>(`/events/${eventId}/designations/${designationId}`, input);
        return data;
    },
    updateStatus: async (eventId: string, designationId: string, status: DesignationStatus) => {
        const { data } = await api.patch<Designation>(`/events/${eventId}/designations/${designationId}/status`, { status });
        return data;
    },
    remove: async (eventId: string, designationId: string) => {
        await api.delete(`/events/${eventId}/designations/${designationId}`);
    },
};

export const eventPostsApi = {
    list: async (eventId: string) => {
        const { data } = await api.get<EventPost[]>(`/events/${eventId}/posts`);
        return data;
    },
    create: async (eventId: string, input: { name: string; capacity?: number; notes?: string; posX?: number; posY?: number }) => {
        const { data } = await api.post<EventPost>(`/events/${eventId}/posts`, input);
        return data;
    },
    update: async (eventId: string, postId: string, input: Partial<{ name: string; capacity: number; notes: string; posX: number; posY: number }>) => {
        const { data } = await api.patch<EventPost>(`/events/${eventId}/posts/${postId}`, input);
        return data;
    },
    remove: async (eventId: string, postId: string) => {
        await api.delete(`/events/${eventId}/posts/${postId}`);
    },
    setFloorPlan: async (eventId: string, input: { floorPlanKey: string; floorPlanUrl: string }) => {
        const { data } = await api.patch<{ floorPlanKey: string; floorPlanUrl: string }>(`/events/${eventId}/posts/floor-plan`, input);
        return data;
    },
};

export interface OccurrenceReport {
    id: string;
    type: string;
    title: string;
    description: string | null;
    audioUrl: string | null;
    createdByUserId: string;
    createdBy: { id: string; name: string };
    createdAt: string;
}

export const occurrenceReportsApi = {
    list: async (eventId: string) => {
        const { data } = await api.get<OccurrenceReport[]>(`/events/${eventId}/occurrence-reports`);
        return data;
    },
    create: async (eventId: string, input: { type: string; title: string; description?: string; audioUrl?: string }) => {
        const { data } = await api.post<OccurrenceReport>(`/events/${eventId}/occurrence-reports`, input);
        return data;
    },
    update: async (eventId: string, reportId: string, input: { type: string; title: string; description?: string; audioUrl?: string }) => {
        const { data } = await api.patch<OccurrenceReport>(`/events/${eventId}/occurrence-reports/${reportId}`, input);
        return data;
    },
    remove: async (eventId: string, reportId: string) => {
        await api.delete(`/events/${eventId}/occurrence-reports/${reportId}`);
    },
};

export const meetingsApi = {
    update: async (eventId: string, input: { agenda?: string; minutes?: string; meetUrl?: string }) => {
        const { data } = await api.patch<Meeting>(`/events/${eventId}/meeting`, input);
        return data;
    },
    getAttendance: async (eventId: string) => {
        const { data } = await api.get<Array<{ userId: string; status: AttendanceStatus; user: { id: string; name: string; email: string } }>>(
            `/events/${eventId}/meeting/attendance`,
        );
        return data;
    },
    markAttendance: async (eventId: string, records: { userId: string; status: AttendanceStatus }[]) => {
        const { data } = await api.put(`/events/${eventId}/meeting/attendance`, { records });
        return data;
    },
};

export interface EventFile {
    id: string;
    name: string;
    storageKey: string | null;
    externalUrl: string | null;
    mimeType: string | null;
    createdAt: string;
}

export const eventFilesApi = {
    list: async (eventId: string) => {
        const { data } = await api.get<EventFile[]>(`/events/${eventId}/files`);
        return data;
    },
    create: async (eventId: string, input: { name: string; externalUrl?: string; storageKey?: string; mimeType?: string }) => {
        const { data } = await api.post<EventFile>(`/events/${eventId}/files`, input);
        return data;
    },
    update: async (eventId: string, fileId: string, input: Partial<{ name: string; externalUrl: string; storageKey: string; mimeType: string }>) => {
        const { data } = await api.patch<EventFile>(`/events/${eventId}/files/${fileId}`, input);
        return data;
    },
    remove: async (eventId: string, fileId: string) => {
        await api.delete(`/events/${eventId}/files/${fileId}`);
    },
};

export interface OccurrenceReportFile {
    id: string;
    name: string;
    storageKey: string | null;
    externalUrl: string | null;
    mimeType: string | null;
    createdAt: string;
}

export const occurrenceReportFilesApi = {
    list: async (eventId: string, reportId: string) => {
        const { data } = await api.get<OccurrenceReportFile[]>(`/events/${eventId}/occurrence-reports/${reportId}/files`);
        return data;
    },
    create: async (eventId: string, reportId: string, input: { name: string; externalUrl?: string; storageKey?: string; mimeType?: string }) => {
        const { data } = await api.post<OccurrenceReportFile>(`/events/${eventId}/occurrence-reports/${reportId}/files`, input);
        return data;
    },
    remove: async (eventId: string, reportId: string, fileId: string) => {
        await api.delete(`/events/${eventId}/occurrence-reports/${reportId}/files/${fileId}`);
    },
};
