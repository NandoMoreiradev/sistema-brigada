// backend/src/auth/login-attempts.service.ts
//
// Adaptado de maskotCrmEdu/backend/src/auth/login-attempts.service.ts. O
// original guarda o contador de falhas no Redis (compartilhado entre
// instâncias). Este projeto ainda não tem infraestrutura de Redis conectada
// (ver .env.example), então o contador aqui é em memória do processo — mesma
// semântica de lockout, mas por instância. Se o backend rodar com mais de uma
// instância atrás de um load balancer, mova este estado para o Redis (o
// `ioredis` já está no package.json) reaproveitando o padrão do maskotCrmEdu.

import { Injectable, Logger } from '@nestjs/common';

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;
const LOCK_MS = 15 * 60 * 1000;

interface AttemptEntry {
    count: number;
    windowExpiresAt: number;
    lockedUntil: number | null;
}

@Injectable()
export class LoginAttemptsService {
    private readonly logger = new Logger(LoginAttemptsService.name);
    private readonly attempts = new Map<string, AttemptEntry>();

    private key(email: string): string {
        return email.trim().toLowerCase();
    }

    async getLockRemaining(email: string): Promise<number> {
        const entry = this.attempts.get(this.key(email));
        if (!entry?.lockedUntil) return 0;

        const remainingMs = entry.lockedUntil - Date.now();
        return remainingMs > 0 ? Math.ceil(remainingMs / 1000) : 0;
    }

    async recordFailure(email: string): Promise<void> {
        const k = this.key(email);
        const now = Date.now();
        const existing = this.attempts.get(k);

        if (!existing || existing.windowExpiresAt < now) {
            this.attempts.set(k, { count: 1, windowExpiresAt: now + WINDOW_MS, lockedUntil: null });
            return;
        }

        existing.count += 1;
        if (existing.count >= MAX_ATTEMPTS) {
            existing.lockedUntil = now + LOCK_MS;
            this.logger.warn(`Conta ${k} bloqueada por ${LOCK_MS / 1000}s após ${existing.count} falhas.`);
        }
    }

    async reset(email: string): Promise<void> {
        this.attempts.delete(this.key(email));
    }
}
