import { Module } from '@nestjs/common';
import { PermissionsService } from './permissions.service';
import { PermissionsController } from './permissions.controller';
import { RoleAssignmentsService } from './role-assignments.service';
import { RoleAssignmentsController } from './role-assignments.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
    imports: [PrismaModule],
    controllers: [PermissionsController, RoleAssignmentsController],
    providers: [PermissionsService, RoleAssignmentsService],
})
export class PermissionsModule {}
