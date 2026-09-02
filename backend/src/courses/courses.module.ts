import { Module } from '@nestjs/common';
import { CoursesService } from './courses.service';
import { CoursesController } from './courses.controller';
import { RoomsService } from './rooms.service';
import { RoomsController } from './rooms.controller';
import { ClassSessionsService } from './class-sessions.service';
import { ClassSessionsController } from './class-sessions.controller';
import { EnrollmentsService } from './enrollments.service';
import { EnrollmentsController } from './enrollments.controller';
import { CourseModulesService } from './course-modules.service';
import { CourseModulesController } from './course-modules.controller';
import { CourseLessonsService } from './course-lessons.service';
import { CourseLessonsController } from './course-lessons.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { UsersModule } from '../users/users.module';
import { CertificatesModule } from '../certificates/certificates.module';

@Module({
    imports: [PrismaModule, UsersModule, CertificatesModule],
    controllers: [
        CoursesController,
        RoomsController,
        ClassSessionsController,
        EnrollmentsController,
        CourseModulesController,
        CourseLessonsController,
    ],
    providers: [
        CoursesService,
        RoomsService,
        ClassSessionsService,
        EnrollmentsService,
        CourseModulesService,
        CourseLessonsService,
    ],
    exports: [CoursesService],
})
export class CoursesModule {}
