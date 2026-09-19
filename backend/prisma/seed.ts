// backend/prisma/seed.ts
//
// Cria/atualiza o usuário SUPER_ADMIN inicial e o catálogo de permissões.
// Credenciais do SUPER_ADMIN vêm exclusivamente do ambiente (mesmo padrão do
// maskotCrmEdu/backend/prisma/seed.ts): sem fallback embutido, o seed falha
// alto quando SUPER_ADMIN_EMAIL/PASSWORD não estão configuradas, em vez de
// criar uma senha previsível por acidente.
//
// SUPER_ADMIN não pertence a uma Organization (User.organizationId é
// opcional no schema) — é o usuário de plataforma, não de uma unidade.

import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';
import { PERMISSIONS_CATALOG } from '../src/permissions/permissions.catalog';
import { DEFAULT_EMAIL_TEMPLATES } from './seed-data/default-email-templates';

dotenv.config();

const prisma = new PrismaClient();

function requiredEnv(name: string): string {
    const value = process.env[name];
    if (!value) {
        throw new Error(
            `[seed] ${name} não está definida. O seed cria/atualiza o Super Admin e ` +
                `não tem valor padrão para credencial. Defina no .env local ou nas ` +
                `variáveis de ambiente do serviço antes de rodar.`,
        );
    }
    return value;
}

const SUPER_ADMIN_EMAIL = requiredEnv('SUPER_ADMIN_EMAIL');
const SUPER_ADMIN_PASSWORD = requiredEnv('SUPER_ADMIN_PASSWORD');

async function seedSuperAdmin() {
    console.log('Verificando usuário Super Admin...');

    const existing = await prisma.user.findUnique({ where: { email: SUPER_ADMIN_EMAIL } });
    const hashedPassword = await bcrypt.hash(SUPER_ADMIN_PASSWORD, 10);

    if (existing) {
        console.log(`Atualizando Super Admin existente (${SUPER_ADMIN_EMAIL})...`);
        await prisma.user.update({
            where: { email: SUPER_ADMIN_EMAIL },
            // isSuperAdminRoot: true é essencial aqui, não só cosmético — sem ele,
            // PermissionsGuard/userHasPermission bloqueia esse SUPER_ADMIN em toda
            // rota com @RequirePermission (ex.: POST /users), porque o bypass de
            // SUPER_ADMIN exige isSuperAdminRoot OU um SystemRole com a permissão.
            // Sem isso, o onboarding manual de uma academia nova (decisão 5 do
            // docs/decisoes.md) trava: dá pra criar a Organization mas não o
            // primeiro ORG_ADMIN dela.
            data: { password: hashedPassword, role: Role.SUPER_ADMIN, isActive: true, isSuperAdminRoot: true },
        });
    } else {
        console.log(`Criando novo Super Admin (${SUPER_ADMIN_EMAIL})...`);
        await prisma.user.create({
            data: {
                name: 'Super Admin',
                email: SUPER_ADMIN_EMAIL,
                password: hashedPassword,
                role: Role.SUPER_ADMIN,
                isSuperAdminRoot: true,
            },
        });
    }
    console.log('✅ Usuário SUPER_ADMIN garantido.');
}

/** Idempotente: roda em todo deploy, então precisa ser upsert, não create. */
async function seedPermissionsCatalog() {
    console.log(`Sincronizando catálogo de permissões (${PERMISSIONS_CATALOG.length} entradas)...`);

    for (const permission of PERMISSIONS_CATALOG) {
        await prisma.permission.upsert({
            where: { id: permission.id },
            update: { name: permission.name, description: permission.description, module: permission.module, group: permission.group },
            create: permission,
        });
    }

    console.log('✅ Catálogo de permissões sincronizado.');
}

/**
 * Idempotente sem sobrescrever: se o template global do gatilho já existe (seja do seed
 * anterior, seja de uma edição manual de um SUPER_ADMIN pelo construtor visual), não mexe
 * nele — só cria o que estiver faltando. Não dá pra usar `upsert` com a chave composta
 * `organizationId_trigger` aqui porque o Prisma não aceita `null` no shorthand de chave
 * única composta quando um dos campos é opcional (só em `findFirst`/`where` "cru").
 */
async function seedDefaultEmailTemplates() {
    console.log(`Garantindo ${DEFAULT_EMAIL_TEMPLATES.length} template(s) de e-mail padrão...`);

    for (const template of DEFAULT_EMAIL_TEMPLATES) {
        const existing = await prisma.emailTemplate.findFirst({
            where: { organizationId: null, trigger: template.trigger },
        });
        if (existing) continue;

        await prisma.emailTemplate.create({ data: { ...template, organizationId: null } });
    }

    console.log('✅ Templates de e-mail padrão garantidos.');
}

async function main() {
    await seedSuperAdmin();
    await seedPermissionsCatalog();
    await seedDefaultEmailTemplates();
}

main()
    .catch((e) => {
        console.error('❌ Erro durante o seed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
