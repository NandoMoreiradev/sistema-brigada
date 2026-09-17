// frontend/src/services/me.ts
// Cliente da API "meus dados" (backend/src/me) — Fase 2/3 de posse de dado
// (docs/decisoes.md): o recorte do próprio usuário autenticado, não a
// listagem inteira da organização (essa fica em courses.ts/staff.ts/etc,
// hoje restrita a quem tem a permissão administrativa do módulo).
//
// Os endpoints /me/* não incluem `instructors`/`_count` no curso (diferente
// de GET /courses) — por isso um tipo próprio `MyCourse`, mais enxuto que o
// `Course` de @/types, em vez de reaproveitar aquele e arriscar acessar um
// campo que não veio.

import { api } from './api';
import type { CourseEvent, EnrollmentStatus, EventStatus } from '@/types';
import type { CertificateStatus } from './certificates';
import type { EventKind, DesignationStatus } from './events';

export interface MyCourse {
    id: string;
    category: string | null;
    vacancies: number | null;
    minAttendancePercent: number;
    requireAllLessonsWatched: boolean;
    recyclingValidityMonths: number | null;
    active: boolean;
    event: CourseEvent;
}

export interface MyCourses {
    instructing: MyCourse[];
    enrolled: Array<MyCourse & { enrollmentId: string; enrollmentStatus: EnrollmentStatus }>;
}

export interface MyEnrollment {
    id: string;
    courseId: string;
    status: EnrollmentStatus;
    enrolledAt: string;
    course: MyCourse;
    certificate: {
        id: string;
        status: CertificateStatus;
        issuedAt: string;
        expiresAt: string | null;
        pdfKey: string | null;
        pdfUrl: string | null;
    } | null;
}

export interface MyDesignation {
    id: string;
    role: string;
    shiftStart: string;
    shiftEnd: string;
    status: DesignationStatus;
    eventOperation: {
        id: string;
        event: {
            id: string;
            kind: EventKind;
            title: string;
            location: string | null;
            startDate: string;
            endDate: string | null;
            status: EventStatus;
        };
    };
}

export interface MyCertificate {
    id: string;
    issuedAt: string;
    expiresAt: string | null;
    status: CertificateStatus;
    pdfKey: string | null;
    pdfUrl: string | null;
    enrollment: { course: MyCourse };
}

export const meApi = {
    getMyCourses: async () => {
        const { data } = await api.get<MyCourses>('/me/courses');
        return data;
    },
    getMyEnrollments: async () => {
        const { data } = await api.get<MyEnrollment[]>('/me/enrollments');
        return data;
    },
    getMyDesignations: async () => {
        const { data } = await api.get<MyDesignation[]>('/me/designations');
        return data;
    },
    getMyCertificates: async () => {
        const { data } = await api.get<MyCertificate[]>('/me/certificates');
        return data;
    },
};
