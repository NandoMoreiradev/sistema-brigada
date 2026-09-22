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
// Decisão 19 (docs/decisoes.md): `create`/`createBulk` bloqueiam designar um
// staff cuja única qualificação registrada (certificado de turma OU
// certificação externa) esteja vencida — completa a parte de "gestão ativa"
// da reciclagem que faltava (o alerta de vencimento já existia).

import { Injectable, NotFoundException, BadRequestException, ForbiddenException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventsService } from './events.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateDesignationDto } from './dto/create-designation.dto';
import { CreateBulkDesignationDto } from './dto/create-bulk-designation.dto';
import { UpdateDesignationDto } from './dto/update-designation.dto';
import { DesignationStatus, CertificateStatus } from '@prisma/client';
import { parseAppDateTime } from '../common/datetime';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { userHasPermission } from '../auth/common/user-has-permission.util';

const designationInclude = {
    staffMember: { include: { user: { select: { id: true, name: true, email: true } } } },
    post: true,
    team: true,
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
            throw new NotFoundException('Este evento não é uma assembleia ou congresso.');
        }
        const operationId = event.operation.id;

        const shiftStart = parseAppDateTime(dto.shiftStart);
        const shiftEnd = parseAppDateTime(dto.shiftEnd);
        if (shiftEnd <= shiftStart) {
            throw new BadRequestException('O fim do turno deve ser depois do início do turno.');
        }

        if (dto.postId) {
            await this.requirePost(dto.postId, operationId);
        }

        const staffMember = await this.validateStaffAvailability(dto.staffMemberId, organizationId, shiftStart, shiftEnd);
        await this.assertHasValidQualification(staffMember);

        const designation = await this.prisma.designation.create({
            data: {
                eventOperationId: operationId,
                staffMemberId: dto.staffMemberId,
                role: dto.role,
                shiftStart,
                shiftEnd,
                postId: dto.postId,
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
     * Escala várias pessoas de uma vez para o mesmo turno/posto (decisão do
     * produto: "dupla"/"trio" é um rótulo por ocasião de escala, não um
     * vínculo permanente — por isso a Team nasce aqui, junto com o lote, e
     * não existe fora dele).
     */
    async createBulk(eventId: string, organizationId: string, dto: CreateBulkDesignationDto) {
        const event = await this.eventsService.findOne(eventId, organizationId);
        if (!event.operation) {
            throw new NotFoundException('Este evento não é uma assembleia ou congresso.');
        }
        const operationId = event.operation.id;

        const shiftStart = parseAppDateTime(dto.shiftStart);
        const shiftEnd = parseAppDateTime(dto.shiftEnd);
        if (shiftEnd <= shiftStart) {
            throw new BadRequestException('O fim do turno deve ser depois do início do turno.');
        }

        if (dto.postId) {
            await this.requirePost(dto.postId, operationId);
        }

        const staffMemberIds = [...new Set(dto.staffMemberIds)];
        if (dto.asTeam && staffMemberIds.length < 2) {
            throw new BadRequestException('Uma equipe (dupla/trio) precisa de pelo menos 2 pessoas.');
        }

        // Valida todo mundo (pertence à org + sem conflito de horário + qualificação
        // em dia) ANTES de criar qualquer coisa — não queremos escalar metade do
        // grupo e falhar no meio.
        const staffMembers = await Promise.all(
            staffMemberIds.map((id) => this.validateStaffAvailability(id, organizationId, shiftStart, shiftEnd)),
        );
        await Promise.all(staffMembers.map((staffMember) => this.assertHasValidQualification(staffMember)));

        const teamName = dto.asTeam ? dto.teamName?.trim() || (await this.generateTeamName(operationId, staffMembers.length)) : undefined;

        const designations = await this.prisma.$transaction(async (tx) => {
            const team = dto.asTeam ? await tx.team.create({ data: { eventOperationId: operationId, name: teamName! } }) : null;

            return Promise.all(
                staffMembers.map((staffMember) =>
                    tx.designation.create({
                        data: {
                            eventOperationId: operationId,
                            staffMemberId: staffMember.id,
                            role: dto.role,
                            shiftStart,
                            shiftEnd,
                            postId: dto.postId,
                            teamId: team?.id,
                        },
                        include: designationInclude,
                    }),
                ),
            );
        });

        await Promise.all(
            designations.map((designation) =>
                this.notificationsService.create({
                    userId: designation.staffMember.user.id,
                    organizationId,
                    type: 'DESIGNATION_ASSIGNED',
                    title: 'Nova designação',
                    message: `Você foi designado(a) como ${dto.role} para o evento "${event.title}".`,
                    link: `/events/${eventId}`,
                }),
            ),
        );

        return designations;
    }

    /** Confirma que o brigadista existe na organização e não tem outro turno que conflite com o horário informado. */
    private async validateStaffAvailability(
        staffMemberId: string,
        organizationId: string,
        shiftStart: Date,
        shiftEnd: Date,
        excludeDesignationId?: string,
    ) {
        const staffMember = await this.prisma.staffMember.findFirst({
            where: { id: staffMemberId, organizationId },
            include: {
                user: { select: { id: true, name: true, email: true } },
            },
        });
        if (!staffMember) {
            throw new NotFoundException(`Membro de equipe (ID ${staffMemberId}) não pertence a esta organização.`);
        }

        // Mesmo brigadista não pode estar escalado em dois turnos que se
        // sobrepõem — mesmo em eventos diferentes. Ignora designações já
        // recusadas: uma recusa libera o horário. Ao editar uma designação
        // existente, ela mesma é excluída da checagem de conflito (senão
        // sempre "conflitaria" com o próprio horário antigo dela).
        const conflicting = await this.prisma.designation.findFirst({
            where: {
                staffMemberId,
                status: { not: DesignationStatus.DECLINED },
                shiftStart: { lt: shiftEnd },
                shiftEnd: { gt: shiftStart },
                ...(excludeDesignationId ? { id: { not: excludeDesignationId } } : {}),
            },
            include: { eventOperation: { include: { event: { select: { title: true } } } } },
        });
        if (conflicting) {
            throw new BadRequestException(
                `${staffMember.user.name} já está escalado(a) no evento "${conflicting.eventOperation.event.title}" ` +
                    `em um turno que conflita com o horário informado.`,
            );
        }

        return staffMember;
    }

    private async requirePost(postId: string, eventOperationId: string) {
        const post = await this.prisma.eventPost.findFirst({ where: { id: postId, eventOperationId } });
        if (!post) {
            throw new NotFoundException('Posto informado não pertence a este evento.');
        }
        return post;
    }

    private async generateTeamName(eventOperationId: string, memberCount: number): Promise<string> {
        const existingCount = await this.prisma.team.count({ where: { eventOperationId } });
        const noun = memberCount === 2 ? 'Dupla' : memberCount === 3 ? 'Trio' : 'Equipe';
        return `${noun} ${existingCount + 1}`;
    }

    /**
     * Decisão 19: bloqueia a designação quando o staff tem uma qualificação
     * (certificado de turma concluída OU certificação externa) vencida e
     * nenhuma outra ainda válida. Quem nunca teve nenhuma das duas (ex.:
     * coordenador que não precisa de certificação específica) não é
     * bloqueado — não há nada para checar.
     */
    private async assertHasValidQualification(staffMember: { userId: string }) {
        const now = new Date();
        const isValid = (expiresAt: Date | null) => !expiresAt || expiresAt > now;

        const [externalCertifications, courseCertificates] = await Promise.all([
            this.prisma.externalCertification.findMany({
                where: { userId: staffMember.userId },
                select: { expiresAt: true },
            }),
            this.prisma.certificate.findMany({
                where: {
                    status: { not: CertificateStatus.REVOKED },
                    enrollment: { studentProfile: { userId: staffMember.userId } },
                },
                select: { expiresAt: true },
            }),
        ]);

        const qualifications = [...externalCertifications, ...courseCertificates];
        if (qualifications.length === 0) return;

        const hasValid = qualifications.some((q) => isValid(q.expiresAt));
        if (!hasValid) {
            throw new ConflictException(
                'Este membro da equipe não tem certificado ou certificação válida no momento — a mais recente está vencida.',
            );
        }
    }

    async findAll(eventId: string, organizationId: string, user: AuthenticatedUser) {
        await this.eventsService.assertCanViewEvent(eventId, organizationId, user);
        const operation = await this.eventsService.requireEventOperation(eventId, organizationId);
        return this.prisma.designation.findMany({
            where: { eventOperationId: operation.id },
            include: designationInclude,
            orderBy: { shiftStart: 'asc' },
        });
    }

    /**
     * Edita uma designação já criada (pessoa, papel, turno ou posto) sem
     * precisar excluir e recriar. Reaplica as mesmas validações do `create`
     * (post pertence ao evento, sem conflito de horário, qualificação em
     * dia) — a própria designação é excluída da checagem de conflito de
     * horário consigo mesma.
     */
    async update(eventId: string, organizationId: string, designationId: string, dto: UpdateDesignationDto) {
        const event = await this.eventsService.findOne(eventId, organizationId);
        if (!event.operation) {
            throw new NotFoundException('Este evento não é uma assembleia ou congresso.');
        }
        const operationId = event.operation.id;

        const designation = await this.prisma.designation.findFirst({
            where: { id: designationId, eventOperationId: operationId },
        });
        if (!designation) {
            throw new NotFoundException(`Designação com ID ${designationId} não encontrada neste evento.`);
        }

        const shiftStart = dto.shiftStart !== undefined ? parseAppDateTime(dto.shiftStart) : designation.shiftStart;
        const shiftEnd = dto.shiftEnd !== undefined ? parseAppDateTime(dto.shiftEnd) : designation.shiftEnd;
        if (shiftEnd <= shiftStart) {
            throw new BadRequestException('O fim do turno deve ser depois do início do turno.');
        }

        const postId = dto.postId !== undefined ? dto.postId : designation.postId;
        if (postId) {
            await this.requirePost(postId, operationId);
        }

        const staffMemberId = dto.staffMemberId ?? designation.staffMemberId;
        const staffMember = await this.validateStaffAvailability(staffMemberId, organizationId, shiftStart, shiftEnd, designationId);
        await this.assertHasValidQualification(staffMember);

        return this.prisma.designation.update({
            where: { id: designationId },
            data: {
                staffMemberId,
                role: dto.role ?? designation.role,
                shiftStart,
                shiftEnd,
                postId: postId ?? null,
            },
            include: designationInclude,
        });
    }

    async updateStatus(
        eventId: string,
        organizationId: string,
        designationId: string,
        status: DesignationStatus,
        user: AuthenticatedUser,
    ) {
        const event = await this.eventsService.findOne(eventId, organizationId);
        if (!event.operation) {
            throw new NotFoundException('Este evento não é uma assembleia ou congresso.');
        }
        const designation = await this.prisma.designation.findFirst({
            where: { id: designationId, eventOperationId: event.operation.id },
            include: designationInclude,
        });
        if (!designation) {
            throw new NotFoundException(`Designação com ID ${designationId} não encontrada neste evento.`);
        }

        const isOwnDesignation = designation.staffMember.userId === user.id;
        if (!isOwnDesignation && !userHasPermission(user, 'events:manage')) {
            throw new ForbiddenException('Você só pode confirmar ou recusar a própria designação.');
        }

        const updated = await this.prisma.designation.update({ where: { id: designationId }, data: { status }, include: designationInclude });

        // Quem organizou o evento precisa saber que uma vaga da escala ficou
        // aberta de novo — sem isso, só descobre olhando a aba manualmente.
        if (status === DesignationStatus.DECLINED && event.createdByUserId !== designation.staffMember.user.id) {
            await this.notificationsService.create({
                userId: event.createdByUserId,
                organizationId,
                type: 'DESIGNATION_DECLINED',
                title: 'Designação recusada',
                message: `${designation.staffMember.user.name} recusou a designação de ${designation.role} no evento "${event.title}".`,
                link: `/events/${eventId}`,
            });
        }

        return updated;
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
