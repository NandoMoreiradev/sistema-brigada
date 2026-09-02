import { Module } from '@nestjs/common';
import { EventsService } from './events.service';
import { EventsController } from './events.controller';
import { DesignationsService } from './designations.service';
import { DesignationsController } from './designations.controller';
import { OccurrenceReportsService } from './occurrence-reports.service';
import { OccurrenceReportsController } from './occurrence-reports.controller';
import { MeetingsService } from './meetings.service';
import { MeetingsController } from './meetings.controller';
import { EventFilesService } from './event-files.service';
import { EventFilesController } from './event-files.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { UserIntegrationsModule } from '../user-integrations/user-integrations.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
    imports: [PrismaModule, UserIntegrationsModule, NotificationsModule],
    controllers: [
        EventsController,
        DesignationsController,
        OccurrenceReportsController,
        MeetingsController,
        EventFilesController,
    ],
    providers: [EventsService, DesignationsService, OccurrenceReportsService, MeetingsService, EventFilesService],
    exports: [EventsService],
})
export class EventsModule {}
