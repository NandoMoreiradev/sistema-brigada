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

import { Injectable, Logger, NotFoundException, BadRequestException, ForbiddenException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventsService } from './events.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateDesignationDto } from './dto/create-designation.dto';
import { CreateBulkDesignationDto } from './dto/create-bulk-designation.dto';
import { UpdateDesignationDto } from './dto/update-designation.dto';
import { DesignationStatus, CertificateStatus, Prisma, StaffStatus } from '@prisma/client';
import { formatAppDateTime } from '../common/datetime';
import { findConflictingDesignation, windowsOverlap } from './designation-conflicts.util';
import { TransactionalEmailService } from '../transactional-email/transactional-email.service';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { userHasPermission } from '../auth/common/user-has-permission.util';

const designationInclude = {
    staffMember: { include: { user: { select: { id: true, name: true, email: true } } } },
    post: true,
    team: true,
    shift: true,
} as const;

@Injectable()
export class DesignationsService {
    private readonly logger = new Logger(DesignationsService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly eventsService: EventsService,
        private readonly notificationsService: NotificationsService,
        private readonly transactionalEmailService: TransactionalEmailService,
    ) {}

    async create(eventId: string, organizationId: string, dto: CreateDesignationDto) {
        const event = await this.eventsService.findOne(eventId, organizationId);
        if (!event.operation) {
            throw new NotFoundException('Este evento não é uma assembleia ou congresso.');
        }
        const operationId = event.operation.id;

        const shift = await this.requireShift(dto.shiftId, operationId);

        if (dto.postId) {
            await this.requirePost(dto.postId, operationId);
        }

        const staffMember = await this.validateStaffAvailability(dto.staffMemberId, organizationId, shift.start, shift.end);
        await this.assertHasValidQualification(staffMember);

        const designation = await this.prisma.designation.create({
            data: {
                eventOperationId: operationId,
                staffMemberId: dto.staffMemberId,
                role: dto.role,
                shiftId: shift.id,
                shiftStart: shift.start,
                shiftEnd: shift.end,
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

        void this.sendAssignedEmails(event, organizationId, [{ user: staffMember.user, role: dto.role }]);

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

        const shifts = await this.requireShifts(dto.shiftIds, operationId);
        // Dois turnos escolhidos que se sobrepõem fariam a mesma pessoa estar em dois lugares.
        for (let i = 0; i < shifts.length; i++) {
            for (let j = i + 1; j < shifts.length; j++) {
                if (windowsOverlap(shifts[i], shifts[j])) {
                    throw new BadRequestException(`Os turnos "${shifts[i].name}" e "${shifts[j].name}" se sobrepõem; escolha turnos que não se sobreponham.`);
                }
            }
        }

        if (dto.postId) {
            await this.requirePost(dto.postId, operationId);
        }

        const staffMemberIds = [...new Set(dto.staffMemberIds)];
        if (dto.asTeam && staffMemberIds.length < 2) {
            throw new BadRequestException('Uma equipe (dupla/trio) precisa de pelo menos 2 pessoas.');
        }

        // Valida todo mundo (pertence à org + sem conflito de horário em NENHUM dos turnos +
        // qualificação em dia) ANTES de criar qualquer coisa — não queremos escalar metade do
        // grupo e falhar no meio.
        const staffMembers = await Promise.all(staffMemberIds.map((id) => this.validateStaffAvailability(id, organizationId, shifts[0].start, shifts[0].end)));
        for (const shift of shifts.slice(1)) {
            await Promise.all(staffMemberIds.map((id) => this.validateStaffAvailability(id, organizationId, shift.start, shift.end)));
        }
        await Promise.all(staffMembers.map((staffMember) => this.assertHasValidQualification(staffMember)));

        const teamName = dto.asTeam ? dto.teamName?.trim() || (await this.generateTeamName(operationId, staffMembers.length)) : undefined;

        const designations = await this.prisma.$transaction(async (tx) => {
            const team = dto.asTeam ? await tx.team.create({ data: { eventOperationId: operationId, name: teamName! } }) : null;

            const created: Prisma.DesignationGetPayload<{ include: typeof designationInclude }>[] = [];
            for (const shift of shifts) {
                for (const staffMember of staffMembers) {
                    created.push(
                        await tx.designation.create({
                            data: {
                                eventOperationId: operationId,
                                staffMemberId: staffMember.id,
                                role: dto.role,
                                shiftId: shift.id,
                                shiftStart: shift.start,
                                shiftEnd: shift.end,
                                postId: dto.postId,
                                teamId: team?.id,
                            },
                            include: designationInclude,
                        }),
                    );
                }
            }
            return created;
        });

        // Uma notificação/e-mail por PESSOA (não por turno): quem é escalado em 3 turnos recebe um aviso só.
        const shiftsByUser = new Map<string, { user: { id: string; name: string; email: string }; count: number }>();
        for (const designation of designations) {
            const entry = shiftsByUser.get(designation.staffMember.user.id) ?? { user: designation.staffMember.user, count: 0 };
            entry.count += 1;
            shiftsByUser.set(designation.staffMember.user.id, entry);
        }

        await Promise.all(
            [...shiftsByUser.values()].map(({ user, count }) =>
                this.notificationsService.create({
                    userId: user.id,
                    organizationId,
                    type: 'DESIGNATION_ASSIGNED',
                    title: 'Nova designação',
                    message:
                        `Você foi designado(a) como ${dto.role} para o evento "${event.title}"` + (count > 1 ? ` (${count} turnos).` : '.'),
                    link: `/events/${eventId}`,
                }),
            ),
        );

        void this.sendAssignedEmails(
            event,
            organizationId,
            [...shiftsByUser.values()].map(({ user }) => ({ user, role: dto.role })),
        );

        return designations;
    }

    /** Fire-and-forget: TransactionalEmailService já captura e loga qualquer falha de envio. */
    private async sendAssignedEmails(
        event: { id: string; title: string; startDate: Date; location: string | null },
        organizationId: string,
        assignments: { user: { name: string; email: string }; role: string }[],
    ): Promise<void> {
        try {
            const organization = await this.prisma.organization.findUnique({ where: { id: organizationId }, select: { name: true } });
            const eventInfo = {
                name: event.title,
                date: formatAppDateTime(event.startDate),
                location: event.location ?? '',
                link: `${process.env.FRONTEND_URL}/events/${event.id}`,
            };

            for (const { user, role } of assignments) {
                await this.transactionalEmailService.sendDesignationAssignedEmail(user, organizationId, organization?.name ?? '', eventInfo, role);
            }
        } catch (error) {
            this.logger.error('Falha ao enviar e-mails de nova designação.', (error as Error).stack);
        }
    }

    /** Confirma que o brigadista existe na organização e não tem outro turno que conflite com o horário informado. */
    private async validateStaffAvailability(
        staffMemberId: string,
        organizationId: string,
        shiftStart: Date,
        shiftEnd: Date,
        excludeDesignationId?: string,
        requireActive = true,
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
        // O filtro de inativos da tela de escala é só conveniência: sem esta checagem uma chamada
        // direta à API escalaria quem foi desativado.
        if (requireActive && staffMember.status !== StaffStatus.ACTIVE) {
            throw new ConflictException(`${staffMember.user.name} está inativo(a) na equipe. Reative o membro antes de escalar.`);
        }

        // Mesmo brigadista não pode estar escalado em dois turnos que se
        // sobrepõem — mesmo em eventos diferentes. Ignora designações já
        // recusadas: uma recusa libera o horário. Ao editar uma designação
        // existente, ela mesma é excluída da checagem de conflito (senão
        // sempre "conflitaria" com o próprio horário antigo dela).
        const conflicting = await findConflictingDesignation(this.prisma, staffMemberId, shiftStart, shiftEnd, excludeDesignationId);
        if (conflicting) {
            throw new BadRequestException(
                `${staffMember.user.name} já está escalado(a) no evento "${conflicting.eventOperation.event.title}" ` +
                    `em um turno que conflita com o horário informado.`,
            );
        }

        return staffMember;
    }

    private async requireShift(shiftId: string, eventOperationId: string) {
        const shift = await this.prisma.eventShift.findFirst({ where: { id: shiftId, eventOperationId } });
        if (!shift) {
            throw new NotFoundException('Turno informado não pertence a este evento.');
        }
        return shift;
    }

    /** Busca todos os turnos pedidos (sem repetir) e falha se algum não pertence ao evento. */
    private async requireShifts(shiftIds: string[], eventOperationId: string) {
        const uniqueIds = [...new Set(shiftIds)];
        const shifts = await this.prisma.eventShift.findMany({
            where: { id: { in: uniqueIds }, eventOperationId },
            orderBy: { start: 'asc' },
        });
        if (shifts.length !== uniqueIds.length) {
            throw new NotFoundException('Um ou mais turnos informados não pertencem a este evento.');
        }
        return shifts;
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
            orderBy: [{ shiftStart: 'asc' }, { createdAt: 'asc' }],
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

        // Mudar de turno copia o horário do novo turno; sem `shiftId` mantém o turno atual.
        const newShift = dto.shiftId !== undefined ? await this.requireShift(dto.shiftId, operationId) : null;
        const shiftStart = newShift?.start ?? designation.shiftStart;
        const shiftEnd = newShift?.end ?? designation.shiftEnd;

        const postId = dto.postId !== undefined ? dto.postId : designation.postId;
        if (postId) {
            await this.requirePost(postId, operationId);
        }

        const staffMemberId = dto.staffMemberId ?? designation.staffMemberId;
        // Só exige membro ativo ao trocar a pessoa: ajustar turno/posto de quem já estava escalado
        // e foi desativado depois não deve ficar bloqueado.
        const isChangingStaffMember = staffMemberId !== designation.staffMemberId;
        const staffMember = await this.validateStaffAvailability(staffMemberId, organizationId, shiftStart, shiftEnd, designationId, isChangingStaffMember);
        await this.assertHasValidQualification(staffMember);

        return this.prisma.designation.update({
            where: { id: designationId },
            data: {
                staffMemberId,
                role: dto.role ?? designation.role,
                shiftId: newShift?.id ?? designation.shiftId,
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
