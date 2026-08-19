// backend/src/notifications/notifications.controller.ts
//
// Adaptado de maskotCrmEdu/backend/src/notifications/notifications.controller.ts.
// `SchoolAccessGuard` -> nada: este projeto resolve a organização ativa via
// `ActiveOrganizationId` (já validada contra `allowedOrganizations` na
// JwtStrategy, ver auth/common/active-organization-id.decorator.ts), sem guard
// dedicado equivalente. `mark-all-read` -> `read-all` (nome pedido nesta tarefa).

import { Controller, Get, Patch, Param, Query, UseGuards } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { CurrentUser } from '../auth/common/current-user.decorator';
import { ActiveOrganizationId } from '../auth/common/active-organization-id.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { GetNotificationsDto } from './dto/get-notifications.dto';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
    constructor(private readonly notificationsService: NotificationsService) {}

    /**
     * Notificações do usuário atual na organização ativa.
     */
    @Get()
    async findMyNotifications(@CurrentUser() user: AuthenticatedUser, @ActiveOrganizationId() organizationId: string | undefined, @Query() query: GetNotificationsDto) {
        return this.notificationsService.findByUser(user.id, organizationId, {
            read: query.read,
            limit: query.limit,
            offset: query.offset,
        });
    }

    /**
     * Apenas a contagem de notificações não lidas.
     */
    @Get('unread-count')
    async getUnreadCount(@CurrentUser() user: AuthenticatedUser, @ActiveOrganizationId() organizationId: string | undefined) {
        const unreadCount = await this.notificationsService.getUnreadCount(user.id, organizationId);
        return { unreadCount };
    }

    /**
     * Marca uma notificação específica como lida.
     */
    @Patch(':id/read')
    async markAsRead(@Param('id') notificationId: string, @CurrentUser() user: AuthenticatedUser) {
        return this.notificationsService.markAsRead(notificationId, user.id);
    }

    /**
     * Marca todas as notificações do usuário (na organização ativa) como lidas.
     */
    @Patch('read-all')
    async markAllAsRead(@CurrentUser() user: AuthenticatedUser, @ActiveOrganizationId() organizationId: string | undefined) {
        return this.notificationsService.markAllAsRead(user.id, organizationId);
    }
}
