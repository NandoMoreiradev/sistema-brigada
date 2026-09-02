// backend/src/permissions/permissions.service.ts
//
// Adaptado de maskotCrmEdu/backend/src/permissions/permissions.service.ts —
// mesma ideia de agrupar por módulo para o editor de cargo renderizar por
// seção. Sem o filtro de `PLATFORM_ONLY_MODULE` do original: aqui não existe
// nenhuma permissão de plataforma (`sys:*`) no catálogo de organização — só
// SystemRole usa string livre pra isso, fora do model Permission.

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Permission } from '@prisma/client';

export type GroupedPermissions = Record<string, Permission[]>;

@Injectable()
export class PermissionsService {
    constructor(private readonly prisma: PrismaService) {}

    async findAllGroupedByModule(): Promise<GroupedPermissions> {
        const permissions = await this.prisma.permission.findMany({
            orderBy: [{ module: 'asc' }, { group: 'asc' }, { name: 'asc' }],
        });

        return permissions.reduce<GroupedPermissions>((grouped, permission) => {
            (grouped[permission.module] ??= []).push(permission);
            return grouped;
        }, {});
    }
}
