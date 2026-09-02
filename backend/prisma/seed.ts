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
            data: { password: hashedPassword, role: Role.SUPER_ADMIN, isActive: true },
        });
    } else {
        console.log(`Criando novo Super Admin (${SUPER_ADMIN_EMAIL})...`);
        await prisma.user.create({
            data: {
                name: 'Super Admin',
                email: SUPER_ADMIN_EMAIL,
                password: hashedPassword,
                role: Role.SUPER_ADMIN,
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

async function main() {
    await seedSuperAdmin();
    await seedPermissionsCatalog();
}

main()
    .catch((e) => {
        console.error('❌ Erro durante o seed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
