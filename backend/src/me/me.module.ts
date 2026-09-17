// backend/src/me/me.module.ts
import { Module } from '@nestjs/common';
import { MeController } from './me.controller';
import { MeService } from './me.service';

@Module({
    controllers: [MeController],
    providers: [MeService],
})
export class MeModule {}
