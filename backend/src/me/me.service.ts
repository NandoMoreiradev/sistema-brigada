// backend/src/me/me.service.ts
//
// Fase 2 de posse de dado (docs/decisoes.md, decisão 22): endpoints "meus
// dados" — o que o usuário logado vê não é a listagem inteira da organização
// (essa já existe em courses/, staff/, certificates/), é só a fatia que é
// dele: turmas que leciona ou cursa, matrículas, escalas de designação e
// certificados. Não há checagem de permissão aqui além de estar autenticado —
// é sempre sobre o próprio usuário (userId vem do JWT, não de input).

import { Injectable, NotFoundException } from '@nestjs/common';
import { AttendanceStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MediaService } from '../media/media.service';
import { appTodayAsDateOnly } from '../common/datetime';

@Injectable()
export class MeService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly mediaService: MediaService,
    ) {}

    /** Mesmo cálculo de CertificatesService.serialize — replicado aqui para não acoplar os dois módulos. */
    private toPdfUrl(pdfKey: string | null): string | null {
        return pdfKey && this.mediaService.publicUrl ? `${this.mediaService.publicUrl}/${pdfKey}` : null;
    }

    async getMyCourses(userId: string, organizationId: string) {
        const [instructing, enrollments] = await Promise.all([
            this.prisma.courseInstructor.findMany({
                where: { userId, course: { organizationId } },
                include: { course: { include: { event: true } } },
            }),
            this.prisma.enrollment.findMany({
                where: { organizationId, studentProfile: { userId } },
                include: { course: { include: { event: true } } },
            }),
        ]);

        const sessions = await this.findUpcomingSessions([...instructing.map((i) => i.courseId), ...enrollments.map((e) => e.courseId)]);
        // Instrutor: a próxima aula da turma. Aluno: a próxima do grupo dele (ou da turma inteira).
        const nextFor = (courseId: string, groupId?: string | null) =>
            sessions.find((s) => s.courseId === courseId && (groupId === undefined || s.groupId === null || s.groupId === groupId)) ?? null;

        return {
            instructing: instructing.map(({ course }) => ({ ...course, nextSession: nextFor(course.id) })),
            enrolled: enrollments.map(({ course, status, id, groupId }) => ({
                ...course,
                enrollmentId: id,
                enrollmentStatus: status,
                nextSession: nextFor(course.id, groupId),
            })),
        };
    }

    /** Aulas de hoje em diante, com a sala — para "onde e quando é a próxima aula". */
    private async findUpcomingSessions(courseIds: string[]) {
        if (courseIds.length === 0) return [];
        return this.prisma.classSession.findMany({
            where: { courseId: { in: courseIds }, date: { gte: appTodayAsDateOnly() } },
            select: {
                id: true,
                courseId: true,
                groupId: true,
                date: true,
                startTime: true,
                endTime: true,
                topic: true,
                room: { select: { name: true } },
                group: { select: { name: true } },
            },
            orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
        });
    }

    /**
     * Onde o aluno está em relação ao certificado da turma: mesma conta que
     * CertificatesService.checkEligibility (presenças sobre o total de aulas agendadas).
     */
    async getMyCourseProgress(userId: string, organizationId: string, courseId: string) {
        const enrollment = await this.prisma.enrollment.findFirst({
            where: { courseId, organizationId, studentProfile: { userId } },
            include: { course: true, certificate: true, group: { select: { id: true, name: true } } },
        });
        if (!enrollment) {
            throw new NotFoundException('Você não está matriculado nesta turma.');
        }

        // Mesma regra do certificado: só as aulas do grupo do aluno (e as da turma inteira).
        const sessionScope = { courseId, OR: [{ groupId: null }, ...(enrollment.groupId ? [{ groupId: enrollment.groupId }] : [])] };
        const [totalSessions, upcomingSessions, attendanceGroups, totalLessons, completedLessons] = await Promise.all([
            this.prisma.classSession.count({ where: sessionScope }),
            this.prisma.classSession.count({ where: { ...sessionScope, date: { gt: appTodayAsDateOnly() } } }),
            this.prisma.attendance.groupBy({ by: ['status'], where: { enrollmentId: enrollment.id }, _count: { _all: true } }),
            this.prisma.courseLesson.count({ where: { module: { courseId }, active: true } }),
            this.prisma.lessonProgress.count({ where: { userId, completed: true, lesson: { module: { courseId }, active: true } } }),
        ]);
        const countOf = (status: AttendanceStatus) => attendanceGroups.find((g) => g.status === status)?._count._all ?? 0;
        const present = countOf(AttendanceStatus.PRESENT);

        return {
            enrollmentStatus: enrollment.status,
            group: enrollment.group,
            attendance: {
                present,
                absent: countOf(AttendanceStatus.ABSENT),
                justifiedAbsent: countOf(AttendanceStatus.JUSTIFIED_ABSENT),
                totalSessions,
                upcomingSessions,
                percent: totalSessions ? Math.round((present / totalSessions) * 100) : 0,
                minPercent: enrollment.course.minAttendancePercent,
            },
            lessons: { completed: completedLessons, total: totalLessons, required: enrollment.course.requireAllLessonsWatched },
            certificate: enrollment.certificate
                ? { id: enrollment.certificate.id, status: enrollment.certificate.status, pdfUrl: this.toPdfUrl(enrollment.certificate.pdfKey) }
                : null,
        };
    }

    async getMyEnrollments(userId: string, organizationId: string) {
        const studentProfile = await this.prisma.studentProfile.findFirst({ where: { userId, organizationId } });
        if (!studentProfile) return [];

        const enrollments = await this.prisma.enrollment.findMany({
            where: { studentProfileId: studentProfile.id },
            include: { course: { include: { event: true } }, certificate: true },
            orderBy: { enrolledAt: 'desc' },
        });

        return enrollments.map((enrollment) => ({
            ...enrollment,
            certificate: enrollment.certificate
                ? { ...enrollment.certificate, pdfUrl: this.toPdfUrl(enrollment.certificate.pdfKey) }
                : null,
        }));
    }

    async getMyDesignations(userId: string, organizationId: string) {
        const staffMember = await this.prisma.staffMember.findFirst({ where: { userId, organizationId } });
        if (!staffMember) return [];

        return this.prisma.designation.findMany({
            where: { staffMemberId: staffMember.id },
            include: { eventOperation: { include: { event: true } } },
            orderBy: { shiftStart: 'desc' },
        });
    }

    async getMyCertificates(userId: string, organizationId: string) {
        const studentProfile = await this.prisma.studentProfile.findFirst({ where: { userId, organizationId } });
        if (!studentProfile) return [];

        const certificates = await this.prisma.certificate.findMany({
            where: { organizationId, enrollment: { studentProfileId: studentProfile.id } },
            include: { enrollment: { include: { course: { include: { event: true } } } } },
            orderBy: { issuedAt: 'desc' },
        });

        return certificates.map((certificate) => ({ ...certificate, pdfUrl: this.toPdfUrl(certificate.pdfKey) }));
    }
}
