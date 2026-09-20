import { Module } from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import { OrganizationsController } from './organizations.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { TransactionalEmailModule } from '../transactional-email/transactional-email.module';
import { CommunicationsModule } from '../communications/communications.module';

@Module({
    imports: [PrismaModule, AuthModule, TransactionalEmailModule, CommunicationsModule],
    controllers: [OrganizationsController],
    providers: [OrganizationsService],
    exports: [OrganizationsService],
})
export class OrganizationsModule {}
