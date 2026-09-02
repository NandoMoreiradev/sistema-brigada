// frontend/src/types/index.ts
//
// Tipos mínimos do domínio, espelhando backend/prisma/schema.prisma.
// Cresce conforme as páginas reais forem implementadas — aqui só o
// suficiente para autenticação e a casca do app.

export type Role = 'SUPER_ADMIN' | 'GROUP_ADMIN' | 'ORG_ADMIN' | 'ORG_USER';

export interface Organization {
    id: string;
    name: string;
    subdomain?: string | null;
    logoUrl?: string | null;
    isMatrix: boolean;
    parentOrganizationId?: string | null;
    groupName?: string | null;
    enabledModules: string[];
}

export interface User {
    id: string;
    email: string;
    name: string;
    phone?: string | null;
    role: Role;
    organizationId?: string | null;
    avatarUrl?: string | null;
    directPermissions: string[];
    isTwoFactorEnabled: boolean;
    isSuperAdminRoot: boolean;
    isActive: boolean;

    // Preenchidos pelo backend em /auth/profile
    organization?: Organization | null;
    allowedOrganizations?: Organization[];
}

// ─── Turmas e matrícula (backend/src/courses, backend/src/users) ──────────

export interface StudentProfile {
    id: string;
    userId: string;
    birthDate?: string | null;
    gender?: string | null;
    guardianName?: string | null;
    guardianPhone?: string | null;
}

export interface OrgPerson {
    id: string;
    name: string;
    email: string;
    phone?: string | null;
    role: Role;
    avatarUrl?: string | null;
    isActive: boolean;
    createdAt: string;
    studentProfile?: StudentProfile | null;
    staffMember?: { id: string; status: string } | null;
    instructorAssignments?: { courseId: string }[];
}

export type EventStatus = 'SCHEDULED' | 'ONGOING' | 'COMPLETED' | 'CANCELLED';
export type EnrollmentStatus = 'ACTIVE' | 'COMPLETED' | 'DROPPED';
export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'JUSTIFIED_ABSENT';

export interface CourseEvent {
    id: string;
    title: string;
    location?: string | null;
    startDate: string;
    endDate?: string | null;
    status: EventStatus;
}

export interface CourseInstructor {
    userId: string;
    user: { id: string; name: string; email: string };
}

export interface Course {
    id: string;
    eventId: string;
    category?: string | null;
    vacancies?: number | null;
    minAttendancePercent: number;
    requireAllLessonsWatched: boolean;
    recyclingValidityMonths?: number | null;
    active: boolean;
    event: CourseEvent;
    instructors: CourseInstructor[];
    _count: { enrollments: number; sessions: number };
}

export interface Room {
    id: string;
    name: string;
    capacity?: number | null;
    active: boolean;
}

export interface ClassSession {
    id: string;
    courseId: string;
    date: string;
    startTime: string;
    endTime: string;
    roomId?: string | null;
    room?: Room | null;
    classLog?: { id: string; content: string } | null;
    _count?: { attendances: number };
}

export interface Enrollment {
    id: string;
    courseId: string;
    status: EnrollmentStatus;
    enrolledAt: string;
    studentProfile: { id: string; user: { id: string; name: string; email: string } };
}

export interface AttendanceRosterEntry {
    enrollmentId: string;
    student: { id: string; name: string; email: string };
    status: AttendanceStatus | null;
}

export interface Paginated<T> {
    data: T[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}
