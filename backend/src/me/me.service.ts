// backend/src/me/me.service.ts
//
// Fase 2 de posse de dado (docs/decisoes.md, decisão 22): endpoints "meus
// dados" — o que o usuário logado vê não é a listagem inteira da organização
// (essa já existe em courses/, staff/, certificates/), é só a fatia que é
// dele: turmas que leciona ou cursa, matrículas, escalas de designação e
// certificados. Não há checagem de permissão aqui além de estar autenticado —
// é sempre sobre o próprio usuário (userId vem do JWT, não de input).

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MediaService } from '../media/media.service';

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

        return {
            instructing: instructing.map(({ course }) => course),
            enrolled: enrollments.map(({ course, status, id }) => ({ ...course, enrollmentId: id, enrollmentStatus: status })),
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
