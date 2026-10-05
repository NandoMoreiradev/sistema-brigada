// backend/src/courses/class-sessions.service.ts
//
// Aulas agendadas de uma turma (`ClassSession`), diário de aula (`ClassLog`, um por
// professor) e presença (`Attendance`). A emissão automática de certificado por
// critério de presença (decisão 16/17 do docs/decisoes.md) é responsabilidade
// do futuro módulo de certificados — aqui só registramos a presença.
//
// Fase 2 de posse de dado (docs/decisoes.md, decisão 22/25): lançar diário de
// aula e presença — `upsertLog`/`markAttendance` — passa a exigir
// `courses:manage` (admin) OU ser CourseInstructor desta turma. Antes disso o
// controller liberava para qualquer ORG_USER autenticado, mesmo de fora da
// turma (ver comentário em class-sessions.controller.ts).
//
// Vários professores: uma aula pode ter professores escalados (`ClassSessionInstructor`).
// Com escala, só eles (ou quem tem `courses:manage`) lançam chamada/diário; sem escala, vale a
// regra anterior (qualquer instrutor da turma). Cada professor mantém o próprio diário.
//
// Sala: duas aulas (de qualquer turma da academia) não podem ocupar a mesma sala em horários
// que se sobrepõem — ver `assertRoomFree`.

import { Injectable, NotFoundException, BadRequestException, ForbiddenException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EnrollmentStatus } from '@prisma/client';
import { CreateClassSessionDto } from './dto/create-class-session.dto';
import { UpdateClassSessionDto } from './dto/update-class-session.dto';
import { UpsertClassLogDto } from './dto/upsert-class-log.dto';
import { MarkAttendanceDto } from './dto/mark-attendance.dto';
import { CertificatesService } from '../certificates/certificates.service';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { userHasPermission } from '../auth/common/user-has-permission.util';
import { assertAreCourseInstructors, INSTRUCTOR_USER_SELECT } from './course-instructors.util';
import { RoomsService } from './rooms.service';

const SESSION_INCLUDE = {
    room: true,
    group: { select: { id: true, name: true } },
    instructors: { include: { user: INSTRUCTOR_USER_SELECT } },
} as const;


@Injectable()
export class ClassSessionsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly certificatesService: CertificatesService,
        private readonly roomsService: RoomsService,
    ) {}

    /** Garante que a turma pertence à organização ativa antes de qualquer operação. */
    private async requireCourse(courseId: string, organizationId: string) {
        const course = await this.prisma.course.findFirst({ where: { id: courseId, organizationId } });
        if (!course) {
            throw new NotFoundException(`Turma com ID ${courseId} não encontrada nesta organização.`);
        }
        return course;
    }

    private async isCourseInstructor(courseId: string, userId: string): Promise<boolean> {
        const link = await this.prisma.courseInstructor.findFirst({ where: { courseId, userId }, select: { id: true } });
        return Boolean(link);
    }

    /**
     * Lançar chamada/diário: admin (`courses:manage`) ou instrutor da turma — e, se a aula tem
     * professores escalados, só um deles.
     */
    private async assertCanRecordClass(courseId: string, sessionId: string, user: AuthenticatedUser) {
        if (userHasPermission(user, 'courses:manage')) return;

        if (!(await this.isCourseInstructor(courseId, user.id))) {
            throw new ForbiddenException('Você não é instrutor desta turma.');
        }

        const assigned = await this.prisma.classSessionInstructor.findMany({
            where: { sessionId },
            include: { user: INSTRUCTOR_USER_SELECT },
        });
        if (assigned.length > 0 && !assigned.some((a) => a.userId === user.id)) {
            throw new ForbiddenException(`Esta aula está a cargo de: ${assigned.map((a) => a.user.name).join(', ')}.`);
        }
    }

    private async assertCourseGroup(courseId: string, groupId: string | null | undefined) {
        if (!groupId) return;
        const group = await this.prisma.courseGroup.findFirst({ where: { id: groupId, courseId }, select: { id: true } });
        if (!group) {
            throw new BadRequestException('Grupo informado não é desta turma.');
        }
    }

    async create(courseId: string, organizationId: string, dto: CreateClassSessionDto) {
        await this.requireCourse(courseId, organizationId);
        await this.assertCourseGroup(courseId, dto.groupId);
        await this.roomsService.assertUsable(dto.roomId, organizationId);
        await this.assertRoomFree(dto.roomId, new Date(dto.date), dto.startTime, dto.endTime);

        const instructorIds = await assertAreCourseInstructors(this.prisma, courseId, dto.instructorIds ?? []);

        return this.prisma.classSession.create({
            data: {
                courseId,
                date: new Date(dto.date),
                startTime: dto.startTime,
                endTime: dto.endTime,
                roomId: dto.roomId,
                groupId: dto.groupId || null,
                topic: dto.topic?.trim() || undefined,
                instructors: { create: instructorIds.map((userId) => ({ userId })) },
            },
            include: SESSION_INCLUDE,
        });
    }

    /**
     * Só quem administra, leciona ou está matriculado na turma vê a agenda (antes bastava ser da
     * academia). O diário só vai para quem administra ou leciona; o aluno recebe, em vez dele, a
     * própria presença em cada aula (`myAttendance`) e só as aulas do grupo dele (e as da turma inteira).
     */
    async findAll(courseId: string, organizationId: string, user: AuthenticatedUser) {
        await this.requireCourse(courseId, organizationId);
        const canSeeLogs = userHasPermission(user, 'courses:manage') || (await this.isCourseInstructor(courseId, user.id));
        const myEnrollment = await this.prisma.enrollment.findFirst({
            where: { courseId, studentProfile: { userId: user.id } },
            select: { id: true, groupId: true },
        });
        if (!canSeeLogs && !myEnrollment) {
            throw new ForbiddenException('Você não faz parte desta turma.');
        }
        const onlyMyGroup = !canSeeLogs && myEnrollment
            ? { OR: [{ groupId: null }, ...(myEnrollment.groupId ? [{ groupId: myEnrollment.groupId }] : [])] }
            : {};

        const sessions = await this.prisma.classSession.findMany({
            where: { courseId, ...onlyMyGroup },
            include: {
                ...SESSION_INCLUDE,
                classLogs: canSeeLogs ? { include: { createdBy: INSTRUCTOR_USER_SELECT }, orderBy: { createdAt: 'asc' } } : false,
                attendances: myEnrollment ? { where: { enrollmentId: myEnrollment.id }, select: { status: true } } : false,
                _count: { select: { attendances: true, classLogs: true } },
            },
            orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
        });

        return sessions.map(({ attendances, ...session }) => ({
            ...session,
            classLogs: session.classLogs ?? [],
            // `null` = chamada desta aula ainda não lançada para o aluno.
            myAttendance: myEnrollment ? (attendances?.[0]?.status ?? null) : undefined,
        }));
    }

    private async requireSession(courseId: string, organizationId: string, sessionId: string) {
        await this.requireCourse(courseId, organizationId);
        const session = await this.prisma.classSession.findFirst({ where: { id: sessionId, courseId } });
        if (!session) {
            throw new NotFoundException(`Aula com ID ${sessionId} não encontrada nesta turma.`);
        }
        return session;
    }

    /**
     * Horários "HH:mm" se comparam como texto. Aulas encostadas (uma termina 10:00, a outra
     * começa 10:00) não contam como conflito. Turmas excluídas (lixeira) não ocupam sala.
     */
    private async assertRoomFree(roomId: string | null | undefined, date: Date, startTime: string, endTime: string, ignoreSessionId?: string) {
        if (!roomId) return;
        const clash = await this.prisma.classSession.findFirst({
            where: {
                roomId,
                date,
                startTime: { lt: endTime },
                endTime: { gt: startTime },
                ...(ignoreSessionId && { id: { not: ignoreSessionId } }),
                course: { deletedAt: null },
            },
            include: { room: true, course: { include: { event: { select: { title: true } } } } },
        });
        if (clash) {
            throw new ConflictException(
                `A sala "${clash.room?.name}" já está ocupada das ${clash.startTime} às ${clash.endTime} por uma aula da turma "${clash.course.event.title}".`,
            );
        }
    }

    /** Período gerado pela programação: data, horário, sala e grupo vêm dela, não da edição avulsa. */
    private assertNotFromSchedule(session: { fromSchedule: boolean }, action: string) {
        if (session.fromSchedule) {
            throw new BadRequestException(`Este período foi gerado pela programação da turma. Para ${action}, altere a programação.`);
        }
    }

    async update(courseId: string, organizationId: string, sessionId: string, dto: UpdateClassSessionDto) {
        const session = await this.requireSession(courseId, organizationId, sessionId);
        if ([dto.date, dto.startTime, dto.endTime, dto.roomId, dto.groupId].some((value) => value !== undefined)) {
            this.assertNotFromSchedule(session, 'mudar data, horário, sala ou grupo');
        }
        await this.assertCourseGroup(courseId, dto.groupId);
        await this.roomsService.assertUsable(dto.roomId, organizationId, session.roomId);
        // Confere o conflito com o resultado final da edição (o que veio no DTO por cima do que já existe).
        await this.assertRoomFree(
            dto.roomId === undefined ? session.roomId : dto.roomId,
            dto.date ? new Date(dto.date) : session.date,
            dto.startTime ?? session.startTime,
            dto.endTime ?? session.endTime,
            sessionId,
        );
        const instructorIds = dto.instructorIds === undefined ? undefined : await assertAreCourseInstructors(this.prisma, courseId, dto.instructorIds);

        return this.prisma.classSession.update({
            where: { id: sessionId },
            data: {
                date: dto.date ? new Date(dto.date) : undefined,
                startTime: dto.startTime,
                endTime: dto.endTime,
                // `null` tira a sala/grupo; `undefined` mantém.
                roomId: dto.roomId,
                groupId: dto.groupId === undefined ? undefined : dto.groupId || null,
                // Texto vazio/`null` limpa o assunto; `undefined` mantém.
                topic: dto.topic === undefined ? undefined : dto.topic?.trim() || null,
                // Lista enviada substitui a escala inteira (lista vazia = qualquer instrutor).
                ...(instructorIds !== undefined && {
                    instructors: { deleteMany: {}, create: instructorIds.map((userId) => ({ userId })) },
                }),
            },
            include: SESSION_INCLUDE,
        });
    }

    async remove(courseId: string, organizationId: string, sessionId: string) {
        const session = await this.requireSession(courseId, organizationId, sessionId);
        this.assertNotFromSchedule(session, 'remover');

        await this.prisma.classSession.delete({ where: { id: sessionId } });
        return { id: sessionId };
    }

    async upsertLog(courseId: string, organizationId: string, sessionId: string, user: AuthenticatedUser, dto: UpsertClassLogDto) {
        await this.requireSession(courseId, organizationId, sessionId);
        await this.assertCanRecordClass(courseId, sessionId, user);
        return this.prisma.classLog.upsert({
            where: { classSessionId_createdByUserId: { classSessionId: sessionId, createdByUserId: user.id } },
            create: { classSessionId: sessionId, content: dto.content, createdByUserId: user.id },
            update: { content: dto.content },
            include: { createdBy: INSTRUCTOR_USER_SELECT },
        });
    }

    /**
     * Retorna a lista de presença da sessão com TODOS os alunos ativos da
     * turma, mesmo os que ainda não têm registro de `Attendance` — a UI de
     * chamada precisa do roster completo, não só das linhas já lançadas.
     */
    async getAttendanceRoster(courseId: string, organizationId: string, sessionId: string, user: AuthenticatedUser) {
        await this.requireSession(courseId, organizationId, sessionId);
        // A lista traz nome e e-mail de todos os alunos: só quem pode lançar a chamada a enxerga.
        await this.assertCanRecordClass(courseId, sessionId, user);
        return this.buildAttendanceRoster(courseId, sessionId);
    }

    /** Aula de um grupo: a lista de chamada traz só os alunos dele. */
    private async buildAttendanceRoster(courseId: string, sessionId: string) {
        const session = await this.prisma.classSession.findUniqueOrThrow({ where: { id: sessionId }, select: { groupId: true } });
        const [enrollments, attendances] = await Promise.all([
            this.prisma.enrollment.findMany({
                where: { courseId, status: EnrollmentStatus.ACTIVE, ...(session.groupId && { groupId: session.groupId }) },
                orderBy: { studentProfile: { user: { name: 'asc' } } },
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

    async markAttendance(courseId: string, organizationId: string, sessionId: string, user: AuthenticatedUser, dto: MarkAttendanceDto) {
        const session = await this.requireSession(courseId, organizationId, sessionId);
        await this.assertCanRecordClass(courseId, sessionId, user);

        const enrollmentIds = dto.records.map((r) => r.enrollmentId);
        const validEnrollments = await this.prisma.enrollment.findMany({
            where: { id: { in: enrollmentIds }, courseId, ...(session.groupId && { groupId: session.groupId }) },
            select: { id: true },
        });
        const validIds = new Set(validEnrollments.map((e) => e.id));
        const invalid = enrollmentIds.filter((id) => !validIds.has(id));
        if (invalid.length > 0) {
            throw new BadRequestException(`Matrícula(s) não pertencem a esta turma${session.groupId ? ' ou a este grupo' : ''}: ${invalid.join(', ')}`);
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

        return this.buildAttendanceRoster(courseId, sessionId);
    }
}
