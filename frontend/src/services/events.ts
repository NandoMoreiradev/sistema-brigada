// frontend/src/services/events.ts
// Cliente da API de eventos polimórficos (backend/src/events).

import { api } from './api';
import type { AttendanceStatus, EventStatus, Paginated } from '@/types';

export type EventKind = 'ASSEMBLEIA' | 'CONGRESSO' | 'ATUACAO_BRIGADA' | 'REUNIAO';
export type DesignationStatus = 'PENDING' | 'CONFIRMED' | 'DECLINED';

export interface EventOperation {
    id: string;
    estimatedAudienceCount: number | null;
    notes: string | null;
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
}

export const designationsApi = {
    list: async (eventId: string) => {
        const { data } = await api.get<Designation[]>(`/events/${eventId}/designations`);
        return data;
    },
    create: async (eventId: string, input: { staffMemberId: string; role: string; shiftStart: string; shiftEnd: string }) => {
        const { data } = await api.post<Designation>(`/events/${eventId}/designations`, input);
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

export interface OccurrenceReport {
    id: string;
    type: string;
    title: string;
    description: string | null;
    createdAt: string;
}

export const occurrenceReportsApi = {
    list: async (eventId: string) => {
        const { data } = await api.get<OccurrenceReport[]>(`/events/${eventId}/occurrence-reports`);
        return data;
    },
    create: async (eventId: string, input: { type: string; title: string; description?: string }) => {
        const { data } = await api.post<OccurrenceReport>(`/events/${eventId}/occurrence-reports`, input);
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
    createdAt: string;
}

export const eventFilesApi = {
    list: async (eventId: string) => {
        const { data } = await api.get<EventFile[]>(`/events/${eventId}/files`);
        return data;
    },
    create: async (eventId: string, input: { name: string; externalUrl?: string; storageKey?: string }) => {
        const { data } = await api.post<EventFile>(`/events/${eventId}/files`, input);
        return data;
    },
    remove: async (eventId: string, fileId: string) => {
        await api.delete(`/events/${eventId}/files/${fileId}`);
    },
};
