// backend/src/courses/class-sessions.service.ts
//
// Aulas agendadas de uma turma (`ClassSession`), diário de aula (`ClassLog`,
// 1:1) e presença (`Attendance`). A emissão automática de certificado por
// critério de presença (decisão 16/17 do docs/decisoes.md) é responsabilidade
// do futuro módulo de certificados — aqui só registramos a presença.

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EnrollmentStatus } from '@prisma/client';
import { CreateClassSessionDto } from './dto/create-class-session.dto';
import { UpdateClassSessionDto } from './dto/update-class-session.dto';
import { UpsertClassLogDto } from './dto/upsert-class-log.dto';
import { MarkAttendanceDto } from './dto/mark-attendance.dto';
import { CertificatesService } from '../certificates/certificates.service';

@Injectable()
export class ClassSessionsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly certificatesService: CertificatesService,
    ) {}

    /** Garante que a turma pertence à organização ativa antes de qualquer operação. */
    private async requireCourse(courseId: string, organizationId: string) {
        const course = await this.prisma.course.findFirst({ where: { id: courseId, organizationId } });
        if (!course) {
            throw new NotFoundException(`Turma com ID ${courseId} não encontrada nesta organização.`);
        }
        return course;
    }

    async create(courseId: string, organizationId: string, dto: CreateClassSessionDto) {
        await this.requireCourse(courseId, organizationId);

        if (dto.roomId) {
            const room = await this.prisma.room.findFirst({ where: { id: dto.roomId, organizationId } });
            if (!room) {
                throw new BadRequestException('Sala informada não pertence a esta organização.');
            }
        }

        return this.prisma.classSession.create({
            data: { courseId, date: new Date(dto.date), startTime: dto.startTime, endTime: dto.endTime, roomId: dto.roomId },
            include: { room: true },
        });
    }

    async findAll(courseId: string, organizationId: string) {
        await this.requireCourse(courseId, organizationId);
        return this.prisma.classSession.findMany({
            where: { courseId },
            include: { room: true, classLog: true, _count: { select: { attendances: true } } },
            orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
        });
    }

    private async requireSession(courseId: string, organizationId: string, sessionId: string) {
        await this.requireCourse(courseId, organizationId);
        const session = await this.prisma.classSession.findFirst({ where: { id: sessionId, courseId } });
        if (!session) {
            throw new NotFoundException(`Aula com ID ${sessionId} não encontrada nesta turma.`);
        }
        return session;
    }

    async update(courseId: string, organizationId: string, sessionId: string, dto: UpdateClassSessionDto) {
        await this.requireSession(courseId, organizationId, sessionId);
        return this.prisma.classSession.update({
            where: { id: sessionId },
            data: {
                date: dto.date ? new Date(dto.date) : undefined,
                startTime: dto.startTime,
                endTime: dto.endTime,
                roomId: dto.roomId,
            },
            include: { room: true },
        });
    }

    async remove(courseId: string, organizationId: string, sessionId: string) {
        await this.requireSession(courseId, organizationId, sessionId);
        await this.prisma.classSession.delete({ where: { id: sessionId } });
        return { id: sessionId };
    }

    async upsertLog(courseId: string, organizationId: string, sessionId: string, userId: string, dto: UpsertClassLogDto) {
        await this.requireSession(courseId, organizationId, sessionId);
        return this.prisma.classLog.upsert({
            where: { classSessionId: sessionId },
            create: { classSessionId: sessionId, content: dto.content, createdByUserId: userId },
            update: { content: dto.content },
        });
    }

    /**
     * Retorna a lista de presença da sessão com TODOS os alunos ativos da
     * turma, mesmo os que ainda não têm registro de `Attendance` — a UI de
     * chamada precisa do roster completo, não só das linhas já lançadas.
     */
    async getAttendanceRoster(courseId: string, organizationId: string, sessionId: string) {
        await this.requireSession(courseId, organizationId, sessionId);

        const [enrollments, attendances] = await Promise.all([
            this.prisma.enrollment.findMany({
                where: { courseId, status: EnrollmentStatus.ACTIVE },
                include: { studentProfile: { include: { user: { select: { id: true, name: true, email: true } } } } },
            }),
            this.prisma.attendance.findMany({ where: { classSessionId: sessionId } }),
        ]);

        const attendanceByEnrollment = new Map(attendances.map((a) => [a.enrollmentId, a]));

        return enrollments.map((enrollment) => ({
            enrollmentId: enrollment.id,
            student: enrollment.studentProfile.user,
            status: attendanceByEnrollment.get(enrollment.id)?.status ?? null,
        }));
    }

    async markAttendance(courseId: string, organizationId: string, sessionId: string, dto: MarkAttendanceDto) {
        await this.requireSession(courseId, organizationId, sessionId);

        const enrollmentIds = dto.records.map((r) => r.enrollmentId);
        const validEnrollments = await this.prisma.enrollment.findMany({
            where: { id: { in: enrollmentIds }, courseId },
            select: { id: true },
        });
        const validIds = new Set(validEnrollments.map((e) => e.id));
        const invalid = enrollmentIds.filter((id) => !validIds.has(id));
        if (invalid.length > 0) {
            throw new BadRequestException(`Matrícula(s) não pertencem a esta turma: ${invalid.join(', ')}`);
        }

        await this.prisma.$transaction(
            dto.records.map((record) =>
                this.prisma.attendance.upsert({
                    where: { enrollmentId_classSessionId: { enrollmentId: record.enrollmentId, classSessionId: sessionId } },
                    create: { enrollmentId: record.enrollmentId, classSessionId: sessionId, status: record.status },
                    update: { status: record.status },
                }),
            ),
        );

        // Presença mudou -> reavalia se algum aluno já atingiu o critério de
        // emissão automática de certificado (decisão 16). Best-effort: nunca
        // deixa a chamada de presença falhar por causa disso.
        await Promise.all(dto.records.map((record) => this.certificatesService.issueIfEligible(record.enrollmentId)));

        return this.getAttendanceRoster(courseId, organizationId, sessionId);
    }
}
