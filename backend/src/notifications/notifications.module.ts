// backend/src/notifications/notifications.module.ts
//
// Adaptado de maskotCrmEdu/backend/src/notifications/notifications.module.ts.
// Sem `EventsModule`/`PushNotificationsModule` (ver notifications.service.ts).

import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
    imports: [PrismaModule],
    controllers: [NotificationsController],
    providers: [NotificationsService],
    exports: [NotificationsService],
})
export class NotificationsModule {}
