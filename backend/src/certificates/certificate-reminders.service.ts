// backend/src/certificates/certificate-reminders.service.ts
//
// Lembretes de vencimento de certificado, configuráveis por academia
// (CertificateReminderSettings). Substitui o aviso único "30 dias antes" que vivia
// em CertificatesService.notifyExpiringCertificates. Regras:
//
// - Cada (certificado, etapa) tem no máximo um registro em CertificateReminder: a chave
//   única é a trava contra reenvio — inclusive com duas instâncias do servidor rodando o
//   cron ao mesmo tempo. Antes, a deduplicação era "existe notificação in-app com este
//   link", criada ANTES do e-mail: se o e-mail falhava, o aviso nunca mais saía.
// - O registro só vira SENT depois que o e-mail sai. FAILED é tentado de novo nas
//   rodadas seguintes, até MAX_ATTEMPTS.
// - Aluno que já tem certificado mais novo e válido do mesmo curso (mesma categoria, ou a
//   turma de reciclagem indicada) não é lembrado: o registro fica SKIPPED.
// - Só pessoas da academia recebem (o aluno e, no resumo, quem a academia escolher).

import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
    CertificateReminderDigestFrequency,
    CertificateReminderSettings,
    CertificateReminderStatus,
    CertificateStatus,
    Prisma,
} from '@prisma/client';
import { fromZonedTime } from 'date-fns-tz';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { TransactionalEmailService } from '../transactional-email/transactional-email.service';
import { APP_TIME_ZONE, formatAppDate } from '../common/datetime';
import { formatCertificateCode } from './certificate-code';
import {
    AFTER_STAGE_CATCH_UP_DAYS,
    ReminderSchedule,
    daysUntilExpiration,
    dueStage,
    stageLabel,
    upcomingStages,
} from './certificate-reminder-schedule';
import { CertificateReminderSettingsDto } from './dto/certificate-reminder-settings.dto';

type ReminderSettingsValues = Omit<CertificateReminderSettings, 'id' | 'organizationId' | 'updatedAt' | 'lastDigestSentAt'>;

/** Academia sem configuração salva: o mesmo comportamento de antes desta tela existir. */
export const DEFAULT_REMINDER_SETTINGS: ReminderSettingsValues = {
    enabled: true,
    daysBefore: [30],
    daysAfter: [],
    sendHour: 8,
    includeRecyclingSuggestion: true,
    digestFrequency: CertificateReminderDigestFrequency.OFF,
    digestRecipientUserIds: [],
    digestWindowDays: 30,
};

const MAX_ATTEMPTS = 3;
const PREVIEW_HORIZON_DAYS = 30;
const DIGEST_RECENTLY_EXPIRED_DAYS = 30;
const DAY_MS = 86_400_000;

const candidateInclude = {
    reminders: { select: { stage: true } },
    enrollment: {
        include: {
            course: { include: { event: { select: { title: true } } } },
            studentProfile: { include: { user: { select: { id: true, name: true, email: true } } } },
        },
    },
} satisfies Prisma.CertificateInclude;

type Candidate = Prisma.CertificateGetPayload<{ include: typeof candidateInclude }>;

const escapeHtml = (value: string) =>
    value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);

@Injectable()
export class CertificateRemindersService {
    private readonly logger = new Logger(CertificateRemindersService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly notificationsService: NotificationsService,
        private readonly transactionalEmailService: TransactionalEmailService,
        private readonly configService: ConfigService,
    ) {}

    private get frontendUrl() {
        return this.configService.get<string>('FRONTEND_URL') || 'http://localhost:5173';
    }

    // ------------------------------------------------------------------ configuração

    async getSettings(organizationId: string) {
        const saved = await this.prisma.certificateReminderSettings.findUnique({ where: { organizationId } });
        return saved ? { ...saved, isDefault: false } : { organizationId, ...DEFAULT_REMINDER_SETTINGS, isDefault: true };
    }

    async saveSettings(organizationId: string, dto: CertificateReminderSettingsDto) {
        const data = await this.normalizeSettings(organizationId, dto);
        const saved = await this.prisma.certificateReminderSettings.upsert({
            where: { organizationId },
            create: { organizationId, ...data },
            update: data,
        });
        return { ...saved, isDefault: false };
    }

    private async normalizeSettings(organizationId: string, dto: CertificateReminderSettingsDto): Promise<ReminderSettingsValues> {
        const recipientIds = [...new Set(dto.digestRecipientUserIds)];
        if (recipientIds.length) {
            const members = await this.prisma.user.count({ where: { id: { in: recipientIds }, organizationId } });
            if (members !== recipientIds.length) {
                throw new BadRequestException('Só pessoas cadastradas nesta academia podem receber o resumo.');
            }
        }
        if (dto.digestFrequency !== CertificateReminderDigestFrequency.OFF && recipientIds.length === 0) {
            throw new BadRequestException('Escolha quem recebe o resumo de vencimentos.');
        }
        return {
            enabled: dto.enabled,
            daysBefore: [...new Set(dto.daysBefore)].sort((a, b) => b - a),
            daysAfter: [...new Set(dto.daysAfter)].sort((a, b) => a - b),
            sendHour: dto.sendHour,
            includeRecyclingSuggestion: dto.includeRecyclingSuggestion,
            digestFrequency: dto.digestFrequency,
            digestRecipientUserIds: recipientIds,
            digestWindowDays: dto.digestWindowDays,
        };
    }

    /**
     * Pré-visualização para a tela de configuração (com os valores ainda não salvos):
     * quais lembretes sairiam nos próximos 30 dias. Usa as mesmas regras do envio.
     */
    async preview(organizationId: string, dto: CertificateReminderSettingsDto) {
        const schedule: ReminderSchedule = { daysBefore: dto.daysBefore, daysAfter: dto.daysAfter };
        const now = new Date();
        const candidates = dto.enabled ? await this.findCandidates(organizationId, schedule, now, PREVIEW_HORIZON_DAYS) : [];
        const superseded = await this.findSupersededIds(candidates, now);

        const items = candidates
            .filter((certificate) => !superseded.has(certificate.id))
            .flatMap((certificate) => {
                const daysUntil = daysUntilExpiration(certificate.expiresAt!, now);
                const sent = new Set(certificate.reminders.map((r) => r.stage));
                return upcomingStages(daysUntil, schedule, sent, PREVIEW_HORIZON_DAYS).map(({ dayOffset, stage }) => ({
                    date: new Date(now.getTime() + dayOffset * DAY_MS),
                    certificateId: certificate.id,
                    studentName: certificate.enrollment.studentProfile.user.name,
                    courseName: certificate.enrollment.course.event.title,
                    expiresAt: certificate.expiresAt,
                    stage,
                    stageLabel: stageLabel(stage),
                }));
            })
            .sort((a, b) => a.date.getTime() - b.date.getTime());

        return { horizonDays: PREVIEW_HORIZON_DAYS, total: items.length, items: items.slice(0, 50), skippedAlreadyRenewed: superseded.size };
    }

    // ------------------------------------------------------------------ histórico e envio manual

    async listForCertificate(certificateId: string, organizationId: string) {
        await this.requireCertificate(certificateId, organizationId);
        const reminders = await this.prisma.certificateReminder.findMany({
            where: { certificateId },
            orderBy: { createdAt: 'desc' },
        });
        return reminders.map((reminder) => ({ ...reminder, stageLabel: stageLabel(reminder.stage) }));
    }

    /** "Enviar lembrete agora": ignora etapas e configuração, mas não manda para certificado revogado ou sem validade. */
    async sendManually(certificateId: string, organizationId: string, triggeredByUserId: string) {
        await this.requireCertificate(certificateId, organizationId);
        const certificate = await this.prisma.certificate.findUniqueOrThrow({ where: { id: certificateId }, include: candidateInclude });
        if (certificate.status === CertificateStatus.REVOKED) {
            throw new BadRequestException('Certificado revogado não recebe lembrete de vencimento.');
        }
        if (!certificate.expiresAt) {
            throw new BadRequestException('Este certificado não tem data de vencimento.');
        }

        const settings = await this.getSettings(organizationId);
        const stage = `manual:${Date.now()}`;
        const reminder = await this.prisma.certificateReminder.create({
            data: { certificateId, organizationId, stage, status: CertificateReminderStatus.SENDING, triggeredByUserId },
        });
        const sent = await this.deliver(certificate, reminder.id, settings.includeRecyclingSuggestion, false);
        if (!sent) {
            throw new BadRequestException('Não foi possível enviar o e-mail. Confira a configuração de e-mail da academia e tente de novo.');
        }
        return { ...(await this.prisma.certificateReminder.findUniqueOrThrow({ where: { id: reminder.id } })), stageLabel: stageLabel(stage) };
    }

    private async requireCertificate(certificateId: string, organizationId: string) {
        const exists = await this.prisma.certificate.count({ where: { id: certificateId, organizationId } });
        if (!exists) {
            throw new NotFoundException(`Certificado com ID ${certificateId} não encontrado nesta organização.`);
        }
    }

    // ------------------------------------------------------------------ rodada agendada

    /** Chamado de hora em hora: processa as academias cujo horário de envio é a hora atual. */
    async runScheduled(now = new Date()): Promise<{ sent: number; failed: number; skipped: number; digests: number }> {
        const hour = Number(now.toLocaleString('en-US', { timeZone: APP_TIME_ZONE, hour: 'numeric', hourCycle: 'h23' }));
        const totals = { sent: 0, failed: 0, skipped: 0, digests: 0 };

        const [withCertificates, allSettings] = await Promise.all([
            this.prisma.certificate.findMany({
                where: { expiresAt: { not: null }, status: { not: CertificateStatus.REVOKED } },
                distinct: ['organizationId'],
                select: { organizationId: true },
            }),
            this.prisma.certificateReminderSettings.findMany(),
        ]);
        const settingsByOrganization = new Map(allSettings.map((settings) => [settings.organizationId, settings]));
        const organizationIds = new Set([...withCertificates.map((c) => c.organizationId), ...settingsByOrganization.keys()]);

        for (const organizationId of organizationIds) {
            const settings = settingsByOrganization.get(organizationId) ?? { ...DEFAULT_REMINDER_SETTINGS, lastDigestSentAt: null };
            if (settings.sendHour !== hour) continue;
            try {
                if (settings.enabled) {
                    const result = await this.processOrganization(organizationId, settings, now);
                    totals.sent += result.sent;
                    totals.failed += result.failed;
                    totals.skipped += result.skipped;
                }
                if (await this.sendDigestIfDue(organizationId, settings, now)) totals.digests++;
            } catch (error) {
                this.logger.error(`Falha nos lembretes de certificado da academia ${organizationId}: ${error.message}`, error.stack);
            }
        }
        return totals;
    }

    private async processOrganization(organizationId: string, settings: ReminderSettingsValues, now: Date) {
        const schedule: ReminderSchedule = { daysBefore: settings.daysBefore, daysAfter: settings.daysAfter };
        const result = { sent: 0, failed: 0, skipped: 0 };
        const candidates = await this.findCandidates(organizationId, schedule, now, 0);
        const superseded = await this.findSupersededIds(candidates, now);

        for (const certificate of candidates) {
            const stage = dueStage(daysUntilExpiration(certificate.expiresAt!, now), schedule);
            if (!stage) continue;

            if (superseded.has(certificate.id)) {
                const created = await this.createReminderIfAbsent(certificate, stage, CertificateReminderStatus.SKIPPED, {
                    error: 'O aluno já tem um certificado mais novo e válido deste curso.',
                });
                if (created) result.skipped++;
                continue;
            }

            const claim = await this.claim(certificate, stage);
            if (!claim) continue;
            const sent = await this.deliver(certificate, claim.id, settings.includeRecyclingSuggestion, claim.firstAttempt);
            if (sent) result.sent++;
            else result.failed++;
        }
        return result;
    }

    /**
     * Certificados (não revogados) cuja validade cai na janela em que alguma etapa pode
     * valer — de `horizonDays` à frente (pré-visualização) até o atraso máximo das etapas "depois".
     */
    private findCandidates(organizationId: string, schedule: ReminderSchedule, now: Date, horizonDays: number): Promise<Candidate[]> {
        if (!schedule.daysBefore.length && !schedule.daysAfter.length) return Promise.resolve([]);
        const maxBefore = Math.max(0, ...schedule.daysBefore);
        const maxAfter = schedule.daysAfter.length ? Math.max(...schedule.daysAfter) + AFTER_STAGE_CATCH_UP_DAYS : 0;
        return this.prisma.certificate.findMany({
            where: {
                organizationId,
                status: { not: CertificateStatus.REVOKED },
                expiresAt: {
                    gte: new Date(now.getTime() - (maxAfter + 1) * DAY_MS),
                    lte: new Date(now.getTime() + (maxBefore + horizonDays + 1) * DAY_MS),
                },
            },
            include: candidateInclude,
        });
    }

    /** Certificados cujo aluno já renovou: outro certificado mais novo, válido, do mesmo curso. */
    private async findSupersededIds(candidates: Candidate[], now: Date): Promise<Set<string>> {
        if (!candidates.length) return new Set();
        const userIds = [...new Set(candidates.map((c) => c.enrollment.studentProfile.userId))];
        const others = await this.prisma.certificate.findMany({
            where: {
                status: { not: CertificateStatus.REVOKED },
                OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
                enrollment: { studentProfile: { userId: { in: userIds } } },
            },
            select: {
                id: true,
                issuedAt: true,
                enrollment: { select: { courseId: true, course: { select: { category: true } }, studentProfile: { select: { userId: true } } } },
            },
        });

        const superseded = new Set<string>();
        for (const certificate of candidates) {
            const { course, studentProfile } = certificate.enrollment;
            const renewed = others.some(
                (other) =>
                    other.id !== certificate.id &&
                    other.enrollment.studentProfile.userId === studentProfile.userId &&
                    other.issuedAt > certificate.issuedAt &&
                    (other.enrollment.courseId === course.recommendedRecyclingCourseId ||
                        (!!course.category && other.enrollment.course.category === course.category)),
            );
            if (renewed) superseded.add(certificate.id);
        }
        return superseded;
    }

    /** Pega a etapa para envio. Devolve null se outra rodada/instância já cuidou dela. */
    private async claim(certificate: Candidate, stage: string): Promise<{ id: string; firstAttempt: boolean } | null> {
        const created = await this.createReminderIfAbsent(certificate, stage, CertificateReminderStatus.SENDING);
        if (created) return { id: created.id, firstAttempt: true };

        const existing = await this.prisma.certificateReminder.findUnique({
            where: { certificateId_stage: { certificateId: certificate.id, stage } },
        });
        if (!existing || existing.status !== CertificateReminderStatus.FAILED || existing.attempts >= MAX_ATTEMPTS) return null;

        // Trava otimista: só uma instância consegue passar de FAILED para SENDING nesta tentativa.
        const { count } = await this.prisma.certificateReminder.updateMany({
            where: { id: existing.id, status: CertificateReminderStatus.FAILED, attempts: existing.attempts },
            data: { status: CertificateReminderStatus.SENDING, attempts: { increment: 1 }, error: null },
        });
        return count ? { id: existing.id, firstAttempt: false } : null;
    }

    private async createReminderIfAbsent(certificate: Candidate, stage: string, status: CertificateReminderStatus, extra: { error?: string } = {}) {
        try {
            return await this.prisma.certificateReminder.create({
                data: { certificateId: certificate.id, organizationId: certificate.organizationId, stage, status, ...extra },
            });
        } catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return null;
            throw error;
        }
    }

    /** Manda o e-mail (e, na 1ª tentativa, a notificação in-app) e grava o resultado no registro. */
    private async deliver(certificate: Candidate, reminderId: string, includeRecycling: boolean, notifyInApp: boolean): Promise<boolean> {
        const now = new Date();
        const expiresAt = certificate.expiresAt!;
        const daysUntil = daysUntilExpiration(expiresAt, now);
        // Pelo dia de calendário, como as etapas: no dia do vencimento ainda é "vence hoje",
        // mesmo que o envio aconteça depois do horário exato de vencimento.
        const expired = daysUntil < 0;
        const student = certificate.enrollment.studentProfile.user;
        const courseName = certificate.enrollment.course.event.title;
        const expiresAtLabel = formatAppDate(expiresAt);
        const myCertificatesPath = `/my-certificates#${certificate.id}`;

        if (notifyInApp) {
            await this.notificationsService.create({
                userId: student.id,
                organizationId: certificate.organizationId,
                type: expired ? 'CERTIFICATE_EXPIRED' : 'CERTIFICATE_EXPIRING',
                title: expired ? 'Certificado vencido' : 'Certificado vencendo em breve',
                message: expired
                    ? `Seu certificado da turma "${courseName}" venceu em ${expiresAtLabel}. Faça a reciclagem para regularizar.`
                    : `Seu certificado da turma "${courseName}" vence em ${expiresAtLabel}. Verifique se é preciso fazer a reciclagem.`,
                link: myCertificatesPath,
            });
        }

        const [organization, recycling] = await Promise.all([
            this.prisma.organization.findUniqueOrThrow({ where: { id: certificate.organizationId }, select: { name: true } }),
            includeRecycling ? this.findRecyclingSuggestion(certificate) : Promise.resolve(null),
        ]);

        const sent = await this.transactionalEmailService.sendCertificateReminderEmail({
            student: { name: student.name, email: student.email },
            organizationId: certificate.organizationId,
            organizationName: organization.name,
            courseName,
            expired,
            certificate: {
                expiresAt: expiresAtLabel,
                daysLeft: String(Math.abs(daysUntil)),
                code: formatCertificateCode(certificate.code),
                link: `${this.frontendUrl}${myCertificatesPath}`,
                verifyLink: `${this.frontendUrl}/validar/${certificate.code}`,
            },
            recycling,
        });

        await this.prisma.certificateReminder.update({
            where: { id: reminderId },
            data: sent
                ? { status: CertificateReminderStatus.SENT, sentAt: new Date(), error: null }
                : { status: CertificateReminderStatus.FAILED, error: 'O e-mail não pôde ser enviado (ver logs do servidor).' },
        });
        return sent;
    }

    /** A turma de reciclagem indicada na turma, se ainda vai começar; senão a próxima turma da mesma categoria. */
    private async findRecyclingSuggestion(certificate: Candidate): Promise<{ courseName: string; startDate: string } | null> {
        const { course } = certificate.enrollment;
        const upcoming: Prisma.CourseWhereInput = {
            organizationId: certificate.organizationId,
            active: true,
            deletedAt: null,
            event: { startDate: { gte: new Date() }, deletedAt: null },
        };

        const suggestion =
            (course.recommendedRecyclingCourseId &&
                (await this.prisma.course.findFirst({
                    where: { ...upcoming, id: course.recommendedRecyclingCourseId },
                    include: { event: { select: { title: true, startDate: true } } },
                }))) ||
            (course.category &&
                (await this.prisma.course.findFirst({
                    where: { ...upcoming, category: course.category, id: { not: course.id } },
                    include: { event: { select: { title: true, startDate: true } } },
                    orderBy: { event: { startDate: 'asc' } },
                }))) ||
            null;

        return suggestion ? { courseName: suggestion.event.title, startDate: formatAppDate(suggestion.event.startDate) } : null;
    }

    // ------------------------------------------------------------------ resumo para a gestão

    private async sendDigestIfDue(
        organizationId: string,
        settings: ReminderSettingsValues & { lastDigestSentAt: Date | null },
        now: Date,
    ): Promise<boolean> {
        if (settings.digestFrequency === CertificateReminderDigestFrequency.OFF || !settings.digestRecipientUserIds.length) return false;
        if (settings.digestFrequency === CertificateReminderDigestFrequency.WEEKLY) {
            const weekday = new Intl.DateTimeFormat('en-US', { timeZone: APP_TIME_ZONE, weekday: 'short' }).format(now);
            if (weekday !== 'Mon') return false;
        }

        // Trava: uma vez por dia, mesmo com duas instâncias rodando o cron.
        const todayStart = fromZonedTime(`${now.toLocaleDateString('en-CA', { timeZone: APP_TIME_ZONE })}T00:00:00`, APP_TIME_ZONE);
        const { count } = await this.prisma.certificateReminderSettings.updateMany({
            where: { organizationId, OR: [{ lastDigestSentAt: null }, { lastDigestSentAt: { lt: todayStart } }] },
            data: { lastDigestSentAt: now },
        });
        if (!count) return false;

        const windowEnd = new Date(now.getTime() + settings.digestWindowDays * DAY_MS);
        const recentStart = new Date(now.getTime() - DIGEST_RECENTLY_EXPIRED_DAYS * DAY_MS);
        const certificates = await this.prisma.certificate.findMany({
            where: { organizationId, status: { not: CertificateStatus.REVOKED }, expiresAt: { gte: recentStart, lte: windowEnd } },
            include: candidateInclude,
            orderBy: { expiresAt: 'asc' },
        });
        const superseded = await this.findSupersededIds(certificates, now);
        const relevant = certificates.filter((c) => !superseded.has(c.id));
        const expiring = relevant.filter((c) => c.expiresAt! >= now);
        const expired = relevant.filter((c) => c.expiresAt! < now);
        // Nada a avisar: não manda e-mail vazio (no diário isso viraria ruído todo dia).
        if (!expiring.length && !expired.length) return false;

        const [organization, recipients] = await Promise.all([
            this.prisma.organization.findUniqueOrThrow({ where: { id: organizationId }, select: { name: true } }),
            this.prisma.user.findMany({
                where: { id: { in: settings.digestRecipientUserIds }, organizationId, isActive: true },
                select: { email: true },
            }),
        ]);

        const subject = `Certificados: ${expiring.length} vencendo nos próximos ${settings.digestWindowDays} dias${expired.length ? `, ${expired.length} vencido(s) recentemente` : ''}`;
        const body = this.renderDigestBody(expiring, expired, settings.digestWindowDays, now);
        const results = await Promise.all(
            recipients.map((recipient) =>
                this.transactionalEmailService.sendOrganizationInternalEmail(recipient.email, organizationId, organization.name, subject, body),
            ),
        );
        return results.some(Boolean);
    }

    private renderDigestBody(expiring: Candidate[], expired: Candidate[], windowDays: number, now: Date): string {
        const row = (certificate: Candidate) => {
            const daysUntil = daysUntilExpiration(certificate.expiresAt!, now);
            const when = daysUntil >= 0 ? (daysUntil === 0 ? 'hoje' : `em ${daysUntil} dia(s)`) : `há ${-daysUntil} dia(s)`;
            return `<tr>
                <td style="padding:6px 8px;border-bottom:1px solid #eee;">${escapeHtml(certificate.enrollment.studentProfile.user.name)}</td>
                <td style="padding:6px 8px;border-bottom:1px solid #eee;">${escapeHtml(certificate.enrollment.course.event.title)}</td>
                <td style="padding:6px 8px;border-bottom:1px solid #eee;white-space:nowrap;">${formatAppDate(certificate.expiresAt!)} (${when})</td>
            </tr>`;
        };
        const table = (title: string, items: Candidate[]) =>
            items.length
                ? `<h3 style="margin:24px 0 8px;">${title}</h3>
                   <table style="width:100%;border-collapse:collapse;font-size:14px;">
                       <tr style="text-align:left;color:#6c757d;"><th style="padding:6px 8px;">Aluno</th><th style="padding:6px 8px;">Turma</th><th style="padding:6px 8px;">Vencimento</th></tr>
                       ${items.map(row).join('')}
                   </table>`
                : '';

        return `
            <p>Resumo dos certificados que precisam de atenção. Quem já fez a reciclagem não aparece aqui.</p>
            ${table(`Vencendo nos próximos ${windowDays} dias`, expiring)}
            ${table(`Vencidos nos últimos ${DIGEST_RECENTLY_EXPIRED_DAYS} dias`, expired)}
            <p style="text-align:center;margin:24px 0;">
                <a href="${this.frontendUrl}/certificates" style="display:inline-block;background-color:#007bff;color:#ffffff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;">Abrir certificados</a>
            </p>
        `;
    }
}
