// backend/src/app.controller.ts

import { Controller, Get } from '@nestjs/common';
import { Public } from './auth/decorator/public.decorator';

@Controller()
export class AppController {
    @Public()
    @Get('health')
    getHealth() {
        return { status: 'ok', timestamp: new Date().toISOString() };
    }
}
