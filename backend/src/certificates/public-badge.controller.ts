// backend/src/certificates/public-badge.controller.ts
//
// Endpoint público que `frontend/src/pages/public/BadgePage.tsx` já espera
// (rota /badge/:token, sem exigir login) — só faltava o backend. Sem
// `@UseGuards(JwtAuthGuard)` neste controller, então já é público por
// natureza (o guard não é global neste projeto); `@Public()` fica só como
// documentação, seguindo o mesmo padrão do health check em app.controller.ts.

import { Controller, Get, Param } from '@nestjs/common';
import { CertificatesService } from './certificates.service';
import { Public } from '../auth/decorator/public.decorator';

@Controller('public/badge')
export class PublicBadgeController {
    constructor(private readonly certificatesService: CertificatesService) {}

    @Public()
    @Get(':token')
    getBadge(@Param('token') token: string) {
        return this.certificatesService.getPublicBadge(token);
    }
}
