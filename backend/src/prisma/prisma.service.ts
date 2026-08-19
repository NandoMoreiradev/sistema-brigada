// backend/src/prisma/prisma.service.ts
//
// Versão simplificada do PrismaService do maskotCrmEdu: mantém apenas a extensão
// de soft delete (filtro automático de leitura + cascata de deleção/restauração
// entre os poucos modelos que têm `deletedAt` neste schema). O original também
// fazia auditoria (AuditLog) e contexto multi-tenant via CLS — nenhum dos dois
// foi portado nesta tarefa (não fazem parte do escopo pedido e não há modelo
// AuditLog neste schema). Se precisar de auditoria de escrita no futuro, o padrão
// do maskotCrmEdu (backend/src/prisma/prisma.service.ts) pode ser reaproveitado.

import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';

// Modelos deste schema que têm `deletedAt` (ver prisma/schema.prisma).
const SOFT_DELETE_MODELS: Set<Prisma.ModelName> = new Set([
    'Organization',
    'User',
    'RoleAssignment',
    'Course',
    'Enrollment',
    'Event',
]);

// Cascata de soft delete: quando o pai é soft-deletado, os filhos (que também
// suportam soft delete) recebem o mesmo `deletedAt`. Cascata de deleção FÍSICA
// não precisa de mapa equivalente aqui — a esmagadora maioria das FKs deste
// schema já usa `onDelete: Cascade` no banco (ver schema.prisma).
const SOFT_DELETE_CASCADE_TARGETS: Partial<Record<Prisma.ModelName, Array<{ model: Prisma.ModelName; field: string }>>> = {
    Organization: [
        { model: 'User', field: 'organizationId' },
        { model: 'Course', field: 'organizationId' },
        { model: 'Event', field: 'organizationId' },
        { model: 'RoleAssignment', field: 'organizationId' },
        { model: 'Enrollment', field: 'organizationId' },
    ],
    Event: [{ model: 'Course', field: 'eventId' }],
    Course: [{ model: 'Enrollment', field: 'courseId' }],
};

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
    private readonly logger = new Logger(PrismaService.name);

    constructor() {
        super({
            transactionOptions: { maxWait: 15000, timeout: 30000 },
            log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
        });
    }

    async onModuleInit() {
        await this.$connect();
        const self = this;

        const extendedClient = this.$extends({
            query: {
                $allModels: {
                    async $allOperations({ model, operation, args, query }) {
                        const client = self as any;

                        // 1. LEITURA — filtro automático de soft delete
                        if (model && SOFT_DELETE_MODELS.has(model as Prisma.ModelName)) {
                            if (['findUnique', 'findFirst', 'findMany', 'count', 'aggregate'].includes(operation)) {
                                if ((args as any).where === undefined) (args as any).where = {};
                                const where = (args as any).where;
                                // Bypass explícito: quem passar `where.deletedAt` continua no controle.
                                if (where.deletedAt === undefined) {
                                    where.deletedAt = null;
                                }
                            }
                        }

                        // Flag para forçar deleção física (`{ where: { hardDelete: true, ... } }`)
                        const isHardDelete = (args as any)?.where?.hardDelete === true;
                        if (isHardDelete) {
                            delete (args as any).where.hardDelete;
                        }

                        let before: any = null;
                        if (
                            model &&
                            SOFT_DELETE_MODELS.has(model as Prisma.ModelName) &&
                            operation === 'delete' &&
                            !isHardDelete &&
                            (args as any)?.where
                        ) {
                            try {
                                before = await client[model].findFirst({
                                    where: { ...(args as any).where, deletedAt: undefined },
                                });
                            } catch {
                                /* melhor esforço — segue sem cascata se não achar o registro */
                            }
                        }

                        // 2. SOFT DELETE (com cascata para os filhos elegíveis)
                        if (
                            model &&
                            SOFT_DELETE_MODELS.has(model as Prisma.ModelName) &&
                            operation === 'delete' &&
                            !isHardDelete
                        ) {
                            const now = new Date();
                            const targets = SOFT_DELETE_CASCADE_TARGETS[model as Prisma.ModelName];

                            if (before?.id && targets) {
                                await Promise.all(
                                    targets.map(async (target) => {
                                        if (SOFT_DELETE_MODELS.has(target.model)) {
                                            await client[target.model].updateMany({
                                                where: { [target.field]: before.id, deletedAt: null },
                                                data: { deletedAt: now },
                                            });
                                        }
                                    }),
                                );
                            }

                            return client[model].update({
                                ...args,
                                data: { deletedAt: now },
                            });
                        }

                        return query(args);
                    },
                },
            },
        });

        Object.assign(this, extendedClient);
        this.logger.log('PrismaService conectado (soft delete habilitado para: ' + Array.from(SOFT_DELETE_MODELS).join(', ') + ')');
    }
}
