import { Module } from '@nestjs/common';
import { EventsService } from './events.service';
import { EventsController } from './events.controller';
import { DesignationsService } from './designations.service';
import { DesignationsController } from './designations.controller';
import { OccurrenceReportsService } from './occurrence-reports.service';
import { OccurrenceReportsController } from './occurrence-reports.controller';
import { OccurrenceReportFilesService } from './occurrence-report-files.service';
import { OccurrenceReportFilesController } from './occurrence-report-files.controller';
import { MeetingsService } from './meetings.service';
import { MeetingsController } from './meetings.controller';
import { EventFilesService } from './event-files.service';
import { EventFilesController } from './event-files.controller';
import { EventPostsService } from './event-posts.service';
import { EventPostsController } from './event-posts.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { UserIntegrationsModule } from '../user-integrations/user-integrations.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
    imports: [PrismaModule, UserIntegrationsModule, NotificationsModule],
    controllers: [
        EventsController,
        DesignationsController,
        OccurrenceReportsController,
        OccurrenceReportFilesController,
        MeetingsController,
        EventFilesController,
        EventPostsController,
    ],
    providers: [
        EventsService,
        DesignationsService,
        OccurrenceReportsService,
        OccurrenceReportFilesService,
        MeetingsService,
        EventFilesService,
        EventPostsService,
    ],
    exports: [EventsService],
})
export class EventsModule {}
