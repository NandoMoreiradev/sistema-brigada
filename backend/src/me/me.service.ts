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

@Injectable()
export class MeService {
    constructor(private readonly prisma: PrismaService) {}

    async getMyCourses(userId: string, organizationId: string) {
        const [instructing, enrollments] = await Promise.all([
            this.prisma.courseInstructor.findMany({
                where: { userId, course: { organizationId } },
                include: { course: true },
            }),
            this.prisma.enrollment.findMany({
                where: { organizationId, studentProfile: { userId } },
                include: { course: true },
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

        return this.prisma.enrollment.findMany({
            where: { studentProfileId: studentProfile.id },
            include: { course: true, certificate: true },
            orderBy: { enrolledAt: 'desc' },
        });
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

        return this.prisma.certificate.findMany({
            where: { organizationId, enrollment: { studentProfileId: studentProfile.id } },
            include: { enrollment: { include: { course: true } } },
            orderBy: { issuedAt: 'desc' },
        });
    }
}
