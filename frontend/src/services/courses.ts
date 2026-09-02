// frontend/src/services/courses.ts
// Cliente da API de turmas/matrícula/presença (backend/src/courses).

import { api } from './api';
import type {
    Course,
    Room,
    ClassSession,
    Enrollment,
    AttendanceRosterEntry,
    AttendanceStatus,
    EventStatus,
    Paginated,
} from '@/types';

export interface CreateCourseInput {
    title: string;
    location?: string;
    startDate: string;
    endDate?: string;
    category?: string;
    vacancies?: number;
    minAttendancePercent?: number;
    recyclingValidityMonths?: number;
    instructorUserIds?: string[];
}

export interface UpdateCourseInput extends Partial<CreateCourseInput> {
    status?: EventStatus;
}

export const coursesApi = {
    list: async (search?: string) => {
        const { data } = await api.get<Paginated<Course>>('/courses', { params: { search, limit: 100 } });
        return data;
    },
    get: async (id: string) => {
        const { data } = await api.get<Course & { sessions: ClassSession[] }>(`/courses/${id}`);
        return data;
    },
    create: async (input: CreateCourseInput) => {
        const { data } = await api.post<Course>('/courses', input);
        return data;
    },
    update: async (id: string, input: UpdateCourseInput) => {
        const { data } = await api.patch<Course>(`/courses/${id}`, input);
        return data;
    },
    remove: async (id: string) => {
        await api.delete(`/courses/${id}`);
    },
    assignInstructor: async (id: string, userId: string) => {
        const { data } = await api.post<Course>(`/courses/${id}/instructors`, { userId });
        return data;
    },
    removeInstructor: async (id: string, userId: string) => {
        const { data } = await api.delete<Course>(`/courses/${id}/instructors/${userId}`);
        return data;
    },
};

export const roomsApi = {
    list: async () => {
        const { data } = await api.get<Room[]>('/rooms');
        return data;
    },
    create: async (input: { name: string; capacity?: number }) => {
        const { data } = await api.post<Room>('/rooms', input);
        return data;
    },
};

export const classSessionsApi = {
    list: async (courseId: string) => {
        const { data } = await api.get<ClassSession[]>(`/courses/${courseId}/sessions`);
        return data;
    },
    create: async (courseId: string, input: { date: string; startTime: string; endTime: string; roomId?: string }) => {
        const { data } = await api.post<ClassSession>(`/courses/${courseId}/sessions`, input);
        return data;
    },
    remove: async (courseId: string, sessionId: string) => {
        await api.delete(`/courses/${courseId}/sessions/${sessionId}`);
    },
    upsertLog: async (courseId: string, sessionId: string, content: string) => {
        const { data } = await api.put(`/courses/${courseId}/sessions/${sessionId}/log`, { content });
        return data;
    },
    getAttendance: async (courseId: string, sessionId: string) => {
        const { data } = await api.get<AttendanceRosterEntry[]>(`/courses/${courseId}/sessions/${sessionId}/attendance`);
        return data;
    },
    markAttendance: async (
        courseId: string,
        sessionId: string,
        records: { enrollmentId: string; status: AttendanceStatus }[],
    ) => {
        const { data } = await api.put<AttendanceRosterEntry[]>(
            `/courses/${courseId}/sessions/${sessionId}/attendance`,
            { records },
        );
        return data;
    },
};

export interface CourseLesson {
    id: string;
    moduleId: string;
    title: string;
    content: string | null;
    videoUrl: string | null;
    duration: number | null;
    order: number;
    progress: Array<{ completed: boolean }>;
}

export interface CourseModuleWithLessons {
    id: string;
    courseId: string;
    title: string;
    order: number;
    lessons: CourseLesson[];
}

export const courseModulesApi = {
    list: async (courseId: string) => {
        const { data } = await api.get<CourseModuleWithLessons[]>(`/courses/${courseId}/modules`);
        return data;
    },
    create: async (courseId: string, input: { title: string; order?: number }) => {
        const { data } = await api.post<CourseModuleWithLessons>(`/courses/${courseId}/modules`, input);
        return data;
    },
    remove: async (courseId: string, moduleId: string) => {
        await api.delete(`/courses/${courseId}/modules/${moduleId}`);
    },
};

export const courseLessonsApi = {
    create: async (courseId: string, input: { moduleId: string; title: string; content?: string; videoUrl?: string; duration?: number }) => {
        const { data } = await api.post<CourseLesson>(`/courses/${courseId}/lessons`, input);
        return data;
    },
    remove: async (courseId: string, lessonId: string) => {
        await api.delete(`/courses/${courseId}/lessons/${lessonId}`);
    },
    markProgress: async (courseId: string, lessonId: string, completed: boolean) => {
        const { data } = await api.put(`/courses/${courseId}/lessons/${lessonId}/progress`, { completed });
        return data;
    },
};

export const enrollmentsApi = {
    list: async (courseId: string) => {
        const { data } = await api.get<Enrollment[]>(`/courses/${courseId}/enrollments`);
        return data;
    },
    enroll: async (courseId: string, userId: string) => {
        const { data } = await api.post<Enrollment>(`/courses/${courseId}/enrollments`, { userId });
        return data;
    },
    updateStatus: async (courseId: string, enrollmentId: string, status: string) => {
        const { data } = await api.patch<Enrollment>(`/courses/${courseId}/enrollments/${enrollmentId}`, { status });
        return data;
    },
};
