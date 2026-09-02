// backend/src/staff/staff.service.ts
//
// Brigadista/bombeiro é um papel adicional sobre o `User` (decisão 8 do
// docs/decisoes.md), promovido manualmente pelo admin (decisão 9) — pode ser
// aluno formado da própria escola ou profissional externo (decisão 6),
// mas mesmo o externo ainda precisa de um `User` (criado via `users/`) antes
// de virar `StaffMember`; certificação de terceiro registrada manualmente
// (decisão 10) é o que `ExternalCertification` cobre para quem não se formou
// aqui.

import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateExternalCertificationDto } from './dto/create-external-certification.dto';

const staffInclude = {
    user: { select: { id: true, name: true, email: true, phone: true } },
    externalCertifications: true,
    _count: { select: { designations: true } },
} as const;

@Injectable()
export class StaffService {
    constructor(private readonly prisma: PrismaService) {}

    async promote(userId: string, organizationId: string, approvedByUserId: string) {
        const user = await this.prisma.user.findFirst({ where: { id: userId, organizationId } });
        if (!user) {
            throw new NotFoundException('Usuário informado não pertence a esta organização.');
        }

        const existing = await this.prisma.staffMember.findUnique({ where: { userId } });
        if (existing) {
            throw new ConflictException('Este usuário já faz parte da equipe de atuação.');
        }

        const staffMember = await this.prisma.staffMember.create({
            data: { userId, organizationId, approvedByUserId },
        });

        return this.findOne(staffMember.id, organizationId);
    }

    findAll(organizationId: string) {
        return this.prisma.staffMember.findMany({
            where: { organizationId },
            include: staffInclude,
            orderBy: { approvedAt: 'desc' },
        });
    }

    async findOne(id: string, organizationId: string) {
        const staffMember = await this.prisma.staffMember.findFirst({
            where: { id, organizationId },
            include: staffInclude,
        });
        if (!staffMember) {
            throw new NotFoundException(`Membro de equipe com ID ${id} não encontrado nesta organização.`);
        }
        return staffMember;
    }

    async updateStatus(id: string, organizationId: string, status: 'ACTIVE' | 'INACTIVE') {
        await this.findOne(id, organizationId);
        await this.prisma.staffMember.update({ where: { id }, data: { status } });
        return this.findOne(id, organizationId);
    }

    async addExternalCertification(staffId: string, organizationId: string, registeredByUserId: string, dto: CreateExternalCertificationDto) {
        await this.findOne(staffId, organizationId);
        return this.prisma.externalCertification.create({
            data: {
                staffMemberId: staffId,
                name: dto.name,
                issuingOrg: dto.issuingOrg,
                issuedAt: dto.issuedAt ? new Date(dto.issuedAt) : undefined,
                expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
                proofFileKey: dto.proofFileKey,
                registeredByUserId,
            },
        });
    }
}
