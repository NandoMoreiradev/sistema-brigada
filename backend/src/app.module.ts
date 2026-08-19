// backend/src/app.module.ts
//
// Importa os módulos efetivamente criados até agora: Prisma, Auth, Media,
// UserIntegrations (fluxo OAuth + GoogleCalendarService) e Notifications.
// Módulos de domínio (courses, events, certificates, staff, etc.) ainda não
// existem — serão adicionados aqui conforme forem construídos.

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { MediaModule } from './media/media.module';
import { UserIntegrationsModule } from './user-integrations/user-integrations.module';
import { NotificationsModule } from './notifications/notifications.module';

@Module({
    imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        PrismaModule,
        AuthModule,
        MediaModule,
        UserIntegrationsModule,
        NotificationsModule,
    ],
    controllers: [AppController],
})
export class AppModule {}
