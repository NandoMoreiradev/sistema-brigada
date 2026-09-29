import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { UserDeletionService } from './user-deletion.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { TransactionalEmailModule } from '../transactional-email/transactional-email.module';

@Module({
    imports: [PrismaModule, AuthModule, TransactionalEmailModule],
    controllers: [UsersController],
    providers: [UsersService, UserDeletionService],
    exports: [UsersService],
})
export class UsersModule {}
