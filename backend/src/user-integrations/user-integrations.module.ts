// backend/src/user-integrations/user-integrations.module.ts
//
// Adaptado de maskotCrmEdu/backend/src/user-integrations/user-integrations.module.ts.
// Substitui o antigo `google-calendar/google-calendar.module.ts` (que só
// declarava o `GoogleCalendarService`, desacoplado do banco): agora que o
// serviço volta a depender do `UserIntegration` persistido, ele é declarado
// aqui junto com o fluxo OAuth (controller + service).

import { Module } from '@nestjs/common';
import { UserIntegrationsController } from './user-integrations.controller';
import { UserIntegrationsService } from './user-integrations.service';
import { GoogleCalendarService } from './google-calendar/google-calendar.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
    imports: [PrismaModule],
    controllers: [UserIntegrationsController],
    providers: [UserIntegrationsService, GoogleCalendarService],
    exports: [GoogleCalendarService],
})
export class UserIntegrationsModule {}
