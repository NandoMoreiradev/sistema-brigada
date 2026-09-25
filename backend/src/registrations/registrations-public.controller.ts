// backend/src/registrations/registrations-public.controller.ts
//
// Sem `@UseGuards(JwtAuthGuard)` neste controller, então já é público por natureza (o
// guard não é global neste projeto) — mesmo padrão de certificates/public-badge.controller.ts.
// `@Public()` fica só como documentação. Throttling local (ThrottlerModule é importado só
// em registrations.module.ts, igual auth.module.ts faz) protege o POST contra abuso —
// é o único endpoint da app que cria dados a partir de uma requisição sem login.

import { Controller, Get, Post, Param, Body, UseGuards } from '@nestjs/common';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import { RegistrationsService } from './registrations.service';
import { SubmitRegistrationDto } from './dto/submit-registration.dto';
import { Public } from '../auth/decorator/public.decorator';

@Controller('public/registrations')
export class RegistrationsPublicController {
    constructor(private readonly registrationsService: RegistrationsService) {}

    @Public()
    @Get(':token')
    getForm(@Param('token') token: string) {
        return this.registrationsService.getPublicFormConfig(token);
    }

    @Public()
    @Post(':token')
    @UseGuards(ThrottlerGuard)
    @Throttle({ default: { limit: 5, ttl: 60000 } })
    submit(@Param('token') token: string, @Body() dto: SubmitRegistrationDto) {
        return this.registrationsService.submitPublic(token, dto);
    }
}
