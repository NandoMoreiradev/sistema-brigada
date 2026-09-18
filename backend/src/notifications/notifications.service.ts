// backend/src/notifications/notifications.service.ts
//
// Adaptado de maskotCrmEdu/backend/src/notifications/notifications.service.ts.
//
// SIMPLIFICADO: sem `EventsGateway` (push em tempo real via WebSocket) nem
// `PushNotificationsService` (push mobile Expo / web-push) — nenhum dos dois
// existe neste projeto. Isto é CRUD puro sobre o model `Notification`, que
// também é mais simples que o original: sem `priority`, sem `leadId`/`metadata`
// (o CRM tinha lead; este produto não), e sem a distinção `isRead`/`readAt`
// (só o boolean `read`). A deduplicação por "notificação repetida em 5 min"
// do original também saiu — sem push para disparar em duplicidade, o pior
// caso aqui é uma linha a mais na lista, não uma notificação push repetida.
//
// `create()` não tem endpoint HTTP correspondente — é chamado diretamente
// pelos módulos de domínio: certificados (emitido/vencendo, ver
// certificates.service.ts e certificate-expiration.scheduler.ts), eventos
// (designação, ver designations.service.ts) e turmas (matrícula confirmada,
// ver enrollments.service.ts).

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

/** Tipos de notificação previstos hoje (ver comentário do campo no schema.prisma). String livre, não é enum no banco. */
export type NotificationType =
    | 'CERTIFICATE_EXPIRING'
    | 'CERTIFICATE_ISSUED'
    | 'DESIGNATION_ASSIGNED'
    | 'ENROLLMENT_CONFIRMED'
    | 'GENERAL'
    | (string & {});

export interface CreateNotificationInput {
    userId: string;
    organizationId: string;
    type: NotificationType;
    title: string;
    message?: string;
    link?: string;
}

export interface FindNotificationsOptions {
    read?: boolean;
    limit?: number;
    offset?: number;
}

@Injectable()
export class NotificationsService {
    constructor(private readonly prisma: PrismaService) {}

    async create(data: CreateNotificationInput) {
        return this.prisma.notification.create({
            data: {
                userId: data.userId,
                organizationId: data.organizationId,
                type: data.type,
                title: data.title,
                message: data.message,
                link: data.link,
            },
        });
    }

    /**
     * Busca notificações do usuário na organização ativa. Sem organização
     * ativa (ex.: SUPER_ADMIN fora do contexto de uma organização) devolve
     * lista vazia em vez de estourar erro.
     */
    async findByUser(userId: string, organizationId: string | undefined, options?: FindNotificationsOptions) {
        if (!userId || !organizationId) {
            return { notifications: [], unreadCount: 0, total: 0 };
        }

        const where: Prisma.NotificationWhereInput = { userId, organizationId };
        if (options?.read !== undefined) {
            where.read = options.read;
        }

        const [notifications, unreadCount, total] = await Promise.all([
            this.prisma.notification.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                take: options?.limit ?? 20,
                skip: options?.offset ?? 0,
            }),
            this.getUnreadCount(userId, organizationId),
            this.prisma.notification.count({ where }),
        ]);

        return { notifications, unreadCount, total };
    }

    async markAsRead(notificationId: string, userId: string) {
        const notification = await this.prisma.notification.findFirst({
            where: { id: notificationId, userId },
        });

        if (!notification) {
            throw new NotFoundException('Notificação não encontrada');
        }

        return this.prisma.notification.update({
            where: { id: notificationId },
            data: { read: true },
        });
    }

    async markAllAsRead(userId: string, organizationId: string | undefined) {
        if (!userId || !organizationId) {
            return { count: 0 };
        }

        return this.prisma.notification.updateMany({
            where: { userId, organizationId, read: false },
            data: { read: true },
        });
    }

    async getUnreadCount(userId: string, organizationId: string | undefined): Promise<number> {
        if (!userId || !organizationId) {
            return 0;
        }

        return this.prisma.notification.count({
            where: { userId, organizationId, read: false },
        });
    }
}
