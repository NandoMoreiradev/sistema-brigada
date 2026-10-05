import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { MediaModule } from '../media/media.module';
import { TrashController } from './trash.controller';
import { TrashService } from './trash.service';

@Module({
    imports: [PrismaModule, MediaModule],
    controllers: [TrashController],
    providers: [TrashService],
})
export class TrashModule {}
