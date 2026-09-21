// backend/src/courses/enrollments.service.ts
//
// Matrícula de aluno em turma. Equivalente reduzido do
// `StudentsService.enrollStudent()` do maskotCrmEdu (docs/decisoes.md) — sem
// lead/financeiro, já que aqui a pessoa (User + StudentProfile) já existe
// antes da matrícula (ver `users/users.service.ts`). Conclusão de matrícula +
// emissão automática de certificado (decisão 16) fica para o módulo de
// certificados; aqui a troca de status é manual.

import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EnrollmentStatus } from '@prisma/client';
import { UsersService } from '../users/users.service';
import { UpdateEnrollmentDto } from './dto/update-enrollment.dto';
import { CreateBulkEnrollmentDto } from './dto/create-bulk-enrollment.dto';
import { CertificatesService } from '../certificates/certificates.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class EnrollmentsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly usersService: UsersService,
        private readonly certificatesService: CertificatesService,
        private readonly notificationsService: NotificationsService,
    ) {}

    private async requireCourse(courseId: string, organizationId: string) {
        const course = await this.prisma.course.findFirst({
            where: { id: courseId, organizationId },
            include: {
                event: { select: { title: true } },
                _count: { select: { enrollments: { where: { status: EnrollmentStatus.ACTIVE } } } },
            },
        });
        if (!course) {
            throw new NotFoundException(`Turma com ID ${courseId} não encontrada nesta organização.`);
        }
        return course;
    }

    async enroll(courseId: string, organizationId: string, userId: string) {
        const course = await this.requireCourse(courseId, organizationId);
        const studentProfile = await this.usersService.requireStudentProfile(userId, organizationId);

        if (course.vacancies !== null && course._count.enrollments >= course.vacancies) {
            throw new BadRequestException('Turma sem vagas disponíveis.');
        }

        const existing = await this.prisma.enrollment.findUnique({
            where: { studentProfileId_courseId: { studentProfileId: studentProfile.id, courseId } },
        });
        if (existing) {
            throw new ConflictException('Este aluno já está matriculado nesta turma.');
        }

        const enrollment = await this.prisma.enrollment.create({
            data: { studentProfileId: studentProfile.id, courseId, organizationId },
            include: { studentProfile: { include: { user: { select: { id: true, name: true, email: true } } } } },
        });

        await this.notificationsService.create({
            userId,
            organizationId,
            type: 'ENROLLMENT_CONFIRMED',
            title: 'Matrícula confirmada',
            message: `Sua matrícula na turma "${course.event.title}" foi confirmada.`,
            link: `/courses/${courseId}`,
        });

        return enrollment;
    }

    /** Matricula vários alunos de uma vez. Valida tudo (vagas + perfil de aluno + duplicidade) antes de criar qualquer matrícula. */
    async enrollBulk(courseId: string, organizationId: string, dto: CreateBulkEnrollmentDto) {
        const course = await this.requireCourse(courseId, organizationId);
        const userIds = [...new Set(dto.userIds)];

        if (course.vacancies !== null && course._count.enrollments + userIds.length > course.vacancies) {
            const remaining = course.vacancies - course._count.enrollments;
            throw new BadRequestException(
                `Turma tem apenas ${remaining} vaga(s) disponível(is) para ${userIds.length} aluno(s) selecionado(s).`,
            );
        }

        const studentProfiles = await Promise.all(
            userIds.map((userId) => this.usersService.requireStudentProfile(userId, organizationId)),
        );

        const existing = await this.prisma.enrollment.findMany({
            where: { courseId, studentProfileId: { in: studentProfiles.map((p) => p.id) } },
            select: { studentProfileId: true },
        });
        if (existing.length > 0) {
            throw new ConflictException('Um ou mais alunos selecionados já estão matriculados nesta turma.');
        }

        const enrollments = await this.prisma.$transaction((tx) =>
            Promise.all(
                studentProfiles.map((studentProfile) =>
                    tx.enrollment.create({
                        data: { studentProfileId: studentProfile.id, courseId, organizationId },
                        include: { studentProfile: { include: { user: { select: { id: true, name: true, email: true } } } } },
                    }),
                ),
            ),
        );

        await Promise.all(
            enrollments.map((enrollment) =>
                this.notificationsService.create({
                    userId: enrollment.studentProfile.user.id,
                    organizationId,
                    type: 'ENROLLMENT_CONFIRMED',
                    title: 'Matrícula confirmada',
                    message: `Sua matrícula na turma "${course.event.title}" foi confirmada.`,
                    link: `/courses/${courseId}`,
                }),
            ),
        );

        return enrollments;
    }

    findAll(courseId: string, organizationId: string) {
        return this.prisma.enrollment.findMany({
            where: { courseId, organizationId },
            include: {
                studentProfile: { include: { user: { select: { id: true, name: true, email: true } } } },
                certificate: { select: { id: true, status: true } },
            },
            orderBy: { enrolledAt: 'desc' },
        });
    }

    async updateStatus(courseId: string, organizationId: string, enrollmentId: string, dto: UpdateEnrollmentDto) {
        const enrollment = await this.prisma.enrollment.findFirst({ where: { id: enrollmentId, courseId, organizationId } });
        if (!enrollment) {
            throw new NotFoundException(`Matrícula com ID ${enrollmentId} não encontrada nesta turma.`);
        }

        const updated = await this.prisma.enrollment.update({
            where: { id: enrollmentId },
            data: { status: dto.status },
            include: { studentProfile: { include: { user: { select: { id: true, name: true, email: true } } } } },
        });

        if (dto.status === EnrollmentStatus.COMPLETED) {
            // Best-effort: se os critérios de presença/aulas já estiverem
            // batendo, emite o certificado junto (decisão 16). Se não,
            // a matrícula fica marcada como concluída mesmo assim — o admin
            // pediu explicitamente essa mudança de status.
            await this.certificatesService.issueIfEligible(enrollmentId);
        }

        return updated;
    }
}
