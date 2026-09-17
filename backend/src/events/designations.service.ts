// backend/src/events/designations.service.ts
// Escala de staff em evento de atuação (decisão 14: turnos/horários, não uma
// designação única para o evento inteiro).
//
// Fase 2 de posse de dado (docs/decisoes.md, decisão 22): `updateStatus`
// (confirmar/recusar escala) passa a exigir `events:manage` (admin) OU que a
// designação seja do próprio StaffMember do usuário chamador — antes disso
// qualquer ORG_USER autenticado podia confirmar/recusar a designação de
// qualquer outra pessoa.
//
// Decisão 19 (docs/decisoes.md): `create` bloqueia designar um staff cuja
// única qualificação registrada (certificado de turma OU certificação
// externa) esteja vencida — completa a parte de "gestão ativa" da
// reciclagem que faltava (o alerta de vencimento já existia).

import { Injectable, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventsService } from './events.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateDesignationDto } from './dto/create-designation.dto';
import { DesignationStatus, CertificateStatus } from '@prisma/client';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { userHasPermission } from '../auth/common/user-has-permission.util';

const designationInclude = {
    staffMember: { include: { user: { select: { id: true, name: true, email: true } } } },
} as const;

@Injectable()
export class DesignationsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly eventsService: EventsService,
        private readonly notificationsService: NotificationsService,
    ) {}

    async create(eventId: string, organizationId: string, dto: CreateDesignationDto) {
        const event = await this.eventsService.findOne(eventId, organizationId);
        if (!event.operation) {
            throw new NotFoundException('Este evento não é uma assembleia, congresso ou atuação de brigada.');
        }

        const staffMember = await this.prisma.staffMember.findFirst({
            where: { id: dto.staffMemberId, organizationId },
            include: {
                user: { select: { id: true, name: true, email: true } },
                externalCertifications: { select: { expiresAt: true } },
            },
        });
        if (!staffMember) {
            throw new NotFoundException('Membro de equipe informado não pertence a esta organização.');
        }

        await this.assertHasValidQualification(staffMember);

        const designation = await this.prisma.designation.create({
            data: {
                eventOperationId: event.operation.id,
                staffMemberId: dto.staffMemberId,
                role: dto.role,
                shiftStart: new Date(dto.shiftStart),
                shiftEnd: new Date(dto.shiftEnd),
            },
            include: designationInclude,
        });

        await this.notificationsService.create({
            userId: staffMember.user.id,
            organizationId,
            type: 'DESIGNATION_ASSIGNED',
            title: 'Nova designação',
            message: `Você foi designado(a) como ${dto.role} para o evento "${event.title}".`,
            link: `/events/${eventId}`,
        });

        return designation;
    }

    /**
     * Decisão 19: bloqueia a designação quando o staff tem uma qualificação
     * (certificado de turma concluída OU certificação externa) vencida e
     * nenhuma outra ainda válida. Quem nunca teve nenhuma das duas (ex.:
     * coordenador que não precisa de certificação específica) não é
     * bloqueado — não há nada para checar.
     */
    private async assertHasValidQualification(staffMember: {
        userId: string;
        externalCertifications: { expiresAt: Date | null }[];
    }) {
        const now = new Date();
        const isValid = (expiresAt: Date | null) => !expiresAt || expiresAt > now;

        const courseCertificates = await this.prisma.certificate.findMany({
            where: {
                status: { not: CertificateStatus.REVOKED },
                enrollment: { studentProfile: { userId: staffMember.userId } },
            },
            select: { expiresAt: true },
        });

        const qualifications = [...staffMember.externalCertifications, ...courseCertificates];
        if (qualifications.length === 0) return;

        const hasValid = qualifications.some((q) => isValid(q.expiresAt));
        if (!hasValid) {
            throw new ConflictException(
                'Este membro da equipe não tem certificado ou certificação válida no momento — a mais recente está vencida.',
            );
        }
    }

    async findAll(eventId: string, organizationId: string) {
        const operation = await this.eventsService.requireEventOperation(eventId, organizationId);
        return this.prisma.designation.findMany({
            where: { eventOperationId: operation.id },
            include: designationInclude,
            orderBy: { shiftStart: 'asc' },
        });
    }

    async updateStatus(
        eventId: string,
        organizationId: string,
        designationId: string,
        status: DesignationStatus,
        user: AuthenticatedUser,
    ) {
        const operation = await this.eventsService.requireEventOperation(eventId, organizationId);
        const designation = await this.prisma.designation.findFirst({
            where: { id: designationId, eventOperationId: operation.id },
            include: { staffMember: { select: { userId: true } } },
        });
        if (!designation) {
            throw new NotFoundException(`Designação com ID ${designationId} não encontrada neste evento.`);
        }

        const isOwnDesignation = designation.staffMember.userId === user.id;
        if (!isOwnDesignation && !userHasPermission(user, 'events:manage')) {
            throw new ForbiddenException('Você só pode confirmar ou recusar a própria designação.');
        }

        return this.prisma.designation.update({ where: { id: designationId }, data: { status }, include: designationInclude });
    }

    async remove(eventId: string, organizationId: string, designationId: string) {
        const operation = await this.eventsService.requireEventOperation(eventId, organizationId);
        const designation = await this.prisma.designation.findFirst({ where: { id: designationId, eventOperationId: operation.id } });
        if (!designation) {
            throw new NotFoundException(`Designação com ID ${designationId} não encontrada neste evento.`);
        }
        await this.prisma.designation.delete({ where: { id: designationId } });
        return { id: designationId };
    }
}
