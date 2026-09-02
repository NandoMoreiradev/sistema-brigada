// backend/src/certificates/certificates.service.ts
//
// Emissão automática de certificado por critério de presença/aulas
// (decisões 16-19 do docs/decisoes.md): sem prova/nota (decisão 18) — só
// presença mínima da turma (`Course.minAttendancePercent`) e, se exigido,
// todas as aulas em vídeo assistidas (`Course.requireAllLessonsWatched`,
// checado contra `LessonProgress` — se a turma não tem nenhuma aula em vídeo
// cadastrada ainda, a exigência é considerada satisfeita por padrão, para não
// bloquear turmas 100% presenciais). `evaluateAndIssue` é chamado
// automaticamente pelo módulo `courses` (ver class-sessions.service.ts e
// enrollments.service.ts) toda vez que a presença muda.

import { Injectable, NotFoundException, ConflictException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MediaService } from '../media/media.service';
import { CertificatePdfService } from './certificate-pdf.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EmailService } from '../common/email.service';
import { Prisma, AttendanceStatus, EnrollmentStatus, CertificateStatus } from '@prisma/client';
import { ListCertificatesDto } from './dto/list-certificates.dto';

const certificateInclude = {
    enrollment: {
        include: {
            course: { include: { event: true } },
            studentProfile: { include: { user: { select: { id: true, name: true, email: true, publicBadgeToken: true } } } },
        },
    },
} satisfies Prisma.CertificateInclude;

interface EligibilityResult {
    eligible: boolean;
    reason?: string;
    enrollment: Prisma.EnrollmentGetPayload<{ include: { course: true; certificate: true; studentProfile: true } }>;
}

@Injectable()
export class CertificatesService {
    private readonly logger = new Logger(CertificatesService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly mediaService: MediaService,
        private readonly certificatePdfService: CertificatePdfService,
        private readonly notificationsService: NotificationsService,
        private readonly emailService: EmailService,
    ) {}

    async findAll(organizationId: string, query: ListCertificatesDto) {
        const { status, expiringInDays, page = 1, limit = 20 } = query;

        const where: Prisma.CertificateWhereInput = { organizationId };
        if (status) {
            where.status = status;
        }
        if (expiringInDays) {
            const limitDate = new Date();
            limitDate.setDate(limitDate.getDate() + expiringInDays);
            where.expiresAt = { lte: limitDate, gte: new Date() };
        }

        const [certificates, total] = await Promise.all([
            this.prisma.certificate.findMany({
                where,
                include: certificateInclude,
                orderBy: { issuedAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
            }),
            this.prisma.certificate.count({ where }),
        ]);

        return {
            data: certificates.map((c) => this.serialize(c)),
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };
    }

    async findOne(id: string, organizationId: string) {
        const certificate = await this.prisma.certificate.findFirst({
            where: { id, organizationId },
            include: certificateInclude,
        });
        if (!certificate) {
            throw new NotFoundException(`Certificado com ID ${id} não encontrado nesta organização.`);
        }
        return this.serialize(certificate);
    }

    private serialize(certificate: Prisma.CertificateGetPayload<{ include: typeof certificateInclude }>) {
        return {
            ...certificate,
            pdfUrl: certificate.pdfKey && this.mediaService.publicUrl ? `${this.mediaService.publicUrl}/${certificate.pdfKey}` : null,
        };
    }

    /** Checa se uma matrícula já atingiu os critérios de emissão da turma, sem criar nada. */
    async checkEligibility(enrollmentId: string): Promise<EligibilityResult> {
        const enrollment = await this.prisma.enrollment.findUnique({
            where: { id: enrollmentId },
            include: { course: true, certificate: true, studentProfile: true },
        });

        if (!enrollment) {
            throw new NotFoundException(`Matrícula com ID ${enrollmentId} não encontrada.`);
        }

        if (enrollment.certificate) {
            return { eligible: false, reason: 'Esta matrícula já possui um certificado emitido.', enrollment };
        }

        if (enrollment.status === EnrollmentStatus.DROPPED) {
            return { eligible: false, reason: 'Matrícula cancelada não é elegível para certificado.', enrollment };
        }

        const totalSessions = await this.prisma.classSession.count({ where: { courseId: enrollment.courseId } });
        if (totalSessions === 0) {
            return { eligible: false, reason: 'A turma ainda não tem nenhuma aula lançada.', enrollment };
        }

        const presentCount = await this.prisma.attendance.count({
            where: { enrollmentId, status: AttendanceStatus.PRESENT },
        });
        const attendancePercent = (presentCount / totalSessions) * 100;

        if (attendancePercent < enrollment.course.minAttendancePercent) {
            return {
                eligible: false,
                reason: `Presença insuficiente: ${attendancePercent.toFixed(0)}% (mínimo exigido: ${enrollment.course.minAttendancePercent}%).`,
                enrollment,
            };
        }

        if (enrollment.course.requireAllLessonsWatched) {
            const totalLessons = await this.prisma.courseLesson.count({
                where: { module: { courseId: enrollment.courseId }, active: true },
            });

            if (totalLessons > 0) {
                const completedCount = await this.prisma.lessonProgress.count({
                    where: {
                        userId: enrollment.studentProfile.userId,
                        completed: true,
                        lesson: { module: { courseId: enrollment.courseId }, active: true },
                    },
                });
                if (completedCount < totalLessons) {
                    return { eligible: false, reason: 'Nem todas as aulas em vídeo foram assistidas.', enrollment };
                }
            }
        }

        return { eligible: true, enrollment };
    }

    /** Chamado automaticamente após lançar presença — silencioso: não é erro não estar elegível ainda. */
    async issueIfEligible(enrollmentId: string) {
        try {
            const result = await this.checkEligibility(enrollmentId);
            if (!result.eligible) return null;
            return this.issue(enrollmentId, true);
        } catch (error) {
            this.logger.warn(`Falha ao avaliar elegibilidade de certificado para matrícula ${enrollmentId}: ${error.message}`);
            return null;
        }
    }

    /** Emissão manual (admin) — explícita, então erra alto quando não elegível. */
    async issueManually(enrollmentId: string, organizationId: string) {
        const result = await this.checkEligibility(enrollmentId);
        if (result.enrollment.organizationId !== organizationId) {
            throw new NotFoundException(`Matrícula com ID ${enrollmentId} não encontrada nesta organização.`);
        }
        if (!result.eligible) {
            if (result.reason?.includes('já possui')) {
                throw new ConflictException(result.reason);
            }
            throw new BadRequestException(result.reason);
        }
        return this.issue(enrollmentId, false);
    }

    private async issue(enrollmentId: string, issuedAutomatically: boolean) {
        const enrollment = await this.prisma.enrollment.findUniqueOrThrow({
            where: { id: enrollmentId },
            include: {
                course: { include: { event: true } },
                studentProfile: { include: { user: { select: { id: true, name: true, email: true } } } },
            },
        });

        const expiresAt = enrollment.course.recyclingValidityMonths
            ? this.addMonths(new Date(), enrollment.course.recyclingValidityMonths)
            : null;

        const certificate = await this.prisma.$transaction(async (tx) => {
            if (enrollment.status !== EnrollmentStatus.COMPLETED) {
                await tx.enrollment.update({ where: { id: enrollmentId }, data: { status: EnrollmentStatus.COMPLETED } });
            }
            return tx.certificate.create({
                data: {
                    enrollmentId,
                    organizationId: enrollment.organizationId,
                    expiresAt,
                    issuedAutomatically,
                },
            });
        });

        await this.generateAndAttachPdf(certificate.id);

        const student = enrollment.studentProfile.user;
        const courseName = enrollment.course.event.title;
        await this.notificationsService.create({
            userId: student.id,
            organizationId: enrollment.organizationId,
            type: 'CERTIFICATE_ISSUED',
            title: 'Certificado emitido',
            message: `Seu certificado da turma "${courseName}" foi emitido.`,
            link: '/certificates',
        });

        return this.findOne(certificate.id, enrollment.organizationId);
    }

    async regeneratePdf(id: string, organizationId: string) {
        const certificate = await this.prisma.certificate.findFirst({ where: { id, organizationId } });
        if (!certificate) {
            throw new NotFoundException(`Certificado com ID ${id} não encontrado nesta organização.`);
        }
        await this.generateAndAttachPdf(id);
        return this.findOne(id, organizationId);
    }

    private async generateAndAttachPdf(certificateId: string) {
        try {
            const certificate = await this.prisma.certificate.findUniqueOrThrow({
                where: { id: certificateId },
                include: {
                    enrollment: { include: { course: { include: { event: true } }, studentProfile: { include: { user: true } } } },
                },
            });

            const [template, organization] = await Promise.all([
                this.prisma.certificateTemplate.findUnique({ where: { organizationId: certificate.organizationId } }),
                this.prisma.organization.findUniqueOrThrow({ where: { id: certificate.organizationId }, select: { name: true } }),
            ]);

            const pdfBuffer = await this.certificatePdfService.generate({ ...certificate, organization }, template);
            const { key } = await this.mediaService.uploadFileFromBuffer(
                pdfBuffer,
                `certificado-${certificateId}.pdf`,
                'application/pdf',
                'certificates',
            );

            await this.prisma.certificate.update({ where: { id: certificateId }, data: { pdfKey: key } });
        } catch (error) {
            this.logger.warn(`Não foi possível gerar/subir o PDF do certificado ${certificateId}: ${error.message}`);
        }
    }

    /**
     * Dados públicos da página do crachá (`GET /public/badge/:token`, sem
     * autenticação) — resolve por `User.publicBadgeToken`. Formato de retorno
     * fixado pelo que `frontend/src/pages/public/BadgePage.tsx` já espera.
     */
    async getPublicBadge(token: string) {
        const user = await this.prisma.user.findUnique({
            where: { publicBadgeToken: token },
            include: {
                organization: { select: { name: true } },
                studentProfile: {
                    include: {
                        enrollments: {
                            include: { course: { include: { event: true } }, certificate: true },
                        },
                    },
                },
            },
        });

        if (!user) {
            throw new NotFoundException('Crachá não encontrado ou inválido.');
        }

        const certificates = (user.studentProfile?.enrollments ?? [])
            .filter((enrollment) => enrollment.certificate)
            .map((enrollment) => ({
                id: enrollment.certificate!.id,
                courseName: enrollment.course.event.title,
                status: enrollment.certificate!.status,
                expiresAt: enrollment.certificate!.expiresAt,
            }))
            .sort((a, b) => (a.expiresAt && b.expiresAt ? +new Date(b.expiresAt) - +new Date(a.expiresAt) : 0));

        return {
            userName: user.name,
            organizationName: user.organization?.name || '—',
            certificates,
        };
    }

    private addMonths(date: Date, months: number): Date {
        const result = new Date(date);
        result.setMonth(result.getMonth() + months);
        return result;
    }

    /**
     * Decisão 19 do docs/decisoes.md: "sistema alerta vencimento". Chamado
     * diariamente pelo job em `certificate-expiration.scheduler.ts`. Notifica
     * uma única vez por certificado ao entrar na janela de 30 dias antes do
     * vencimento — a deduplicação é feita checando se já existe uma
     * `Notification` desse tipo com o link específico deste certificado
     * (não há campo próprio para "já notificado" no schema).
     */
    async notifyExpiringCertificates(windowDays = 30): Promise<number> {
        const now = new Date();
        const windowEnd = new Date(now);
        windowEnd.setDate(windowEnd.getDate() + windowDays);

        const expiring = await this.prisma.certificate.findMany({
            where: { status: CertificateStatus.VALID, expiresAt: { gte: now, lte: windowEnd } },
            include: {
                enrollment: {
                    include: {
                        course: { include: { event: true } },
                        studentProfile: { include: { user: { select: { id: true, name: true, email: true } } } },
                    },
                },
            },
        });

        let notifiedCount = 0;

        for (const certificate of expiring) {
            const link = `/certificates#${certificate.id}`;
            const alreadyNotified = await this.prisma.notification.findFirst({
                where: { type: 'CERTIFICATE_EXPIRING', link },
            });
            if (alreadyNotified) continue;

            const student = certificate.enrollment.studentProfile.user;
            const courseName = certificate.enrollment.course.event.title;
            const expiresAtLabel = certificate.expiresAt!.toLocaleDateString('pt-BR');
            const message = `Seu certificado da turma "${courseName}" vence em ${expiresAtLabel}. Verifique se é preciso fazer a reciclagem.`;

            await this.notificationsService.create({
                userId: student.id,
                organizationId: certificate.organizationId,
                type: 'CERTIFICATE_EXPIRING',
                title: 'Certificado vencendo em breve',
                message,
                link,
            });

            await this.emailService.sendNotificationEmail(student.email, student.name, 'Seu certificado está vencendo', message, `${process.env.FRONTEND_URL}/certificates`);

            notifiedCount++;
        }

        return notifiedCount;
    }
}
