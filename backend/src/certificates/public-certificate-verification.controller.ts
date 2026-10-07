// backend/src/certificates/public-certificate-verification.controller.ts
//
// Validação pública de um certificado pelo código impresso no PDF (página
// /validar/:code do frontend, alvo do QR). Público pelo mesmo motivo do
// public-badge.controller.ts (não há guard global). Com throttling por IP: o
// código não é adivinhável, mas sem limite alguém poderia ficar tentando.

import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import { CertificatesService } from './certificates.service';
import { Public } from '../auth/decorator/public.decorator';

@Controller('public/certificates')
export class PublicCertificateVerificationController {
    constructor(private readonly certificatesService: CertificatesService) {}

    @Public()
    @Get(':code')
    @UseGuards(ThrottlerGuard)
    @Throttle({ default: { limit: 20, ttl: 60000 } })
    verify(@Param('code') code: string) {
        return this.certificatesService.verifyByCode(code);
    }
}
