import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { RegistrationsService } from './registrations.service';
import { RegistrationsPublicController } from './registrations-public.controller';
import { RegistrationsAdminController } from './registrations-admin.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { UsersModule } from '../users/users.module';
import { TransactionalEmailModule } from '../transactional-email/transactional-email.module';

@Module({
    imports: [
        PrismaModule,
        UsersModule,
        TransactionalEmailModule,
        // Escopo local, igual auth.module.ts — não há ThrottlerGuard global neste projeto.
        ThrottlerModule.forRoot([{ ttl: 60000, limit: 5 }]),
    ],
    controllers: [RegistrationsPublicController, RegistrationsAdminController],
    providers: [RegistrationsService],
})
export class RegistrationsModule {}
