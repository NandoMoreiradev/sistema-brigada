// backend/src/app.module.ts
//
// Importa os módulos de plataforma (Prisma, Auth, Media, UserIntegrations,
// Notifications) e os módulos de domínio construídos até agora: Organizations
// (tenant), Users (pessoas/perfis), Courses (turmas/matrícula/presença),
// Certificates (emissão automática de certificado, crachá digital, PDF),
// Staff (brigadista/bombeiro) e Events (assembleia/congresso/atuação de
// brigada/reunião — o tronco polimórfico `Event`, ver docs/decisoes.md).

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { MediaModule } from './media/media.module';
import { UserIntegrationsModule } from './user-integrations/user-integrations.module';
import { NotificationsModule } from './notifications/notifications.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { UsersModule } from './users/users.module';
import { CoursesModule } from './courses/courses.module';
import { CertificatesModule } from './certificates/certificates.module';
import { StaffModule } from './staff/staff.module';
import { EventsModule } from './events/events.module';

@Module({
    imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        PrismaModule,
        AuthModule,
        MediaModule,
        UserIntegrationsModule,
        NotificationsModule,
        OrganizationsModule,
        UsersModule,
        CoursesModule,
        CertificatesModule,
        StaffModule,
        EventsModule,
    ],
    controllers: [AppController],
})
export class AppModule {}
