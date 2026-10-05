// backend/src/trash/trash.controller.ts
//
// Lixeira das entidades com soft delete. Tudo atrás de `trash:manage` (admins passam sempre —
// ver user-has-permission.util.ts) e restrito à academia ativa. `:entity` = courses | events |
// people | roles.

import { BadRequestException, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { RolesGuard } from '../auth/guard/roles.guard';
import { PermissionsGuard, RequirePermission } from '../auth/guard/permissions.guard';
import { ActiveOrganizationId } from '../auth/common/active-organization-id.decorator';
import { TrashService } from './trash.service';

@Controller('trash')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@RequirePermission('trash:manage')
export class TrashController {
    constructor(private readonly trashService: TrashService) {}

    private requireOrganizationId(organizationId: string | undefined): string {
        if (!organizationId) {
            throw new BadRequestException('Selecione uma organização ativa para gerenciar a lixeira.');
        }
        return organizationId;
    }

    @Get(':entity')
    list(@Param('entity') entity: string, @ActiveOrganizationId() organizationId: string | undefined) {
        return this.trashService.list(TrashService.assertEntity(entity), this.requireOrganizationId(organizationId));
    }

    @Post(':entity/:id/restore')
    restore(@Param('entity') entity: string, @Param('id') id: string, @ActiveOrganizationId() organizationId: string | undefined) {
        return this.trashService.restore(TrashService.assertEntity(entity), id, this.requireOrganizationId(organizationId));
    }

    @Get(':entity/:id/purge-check')
    purgeCheck(@Param('entity') entity: string, @Param('id') id: string, @ActiveOrganizationId() organizationId: string | undefined) {
        return this.trashService.purgeCheck(TrashService.assertEntity(entity), id, this.requireOrganizationId(organizationId));
    }

    @Delete(':entity/:id')
    purge(@Param('entity') entity: string, @Param('id') id: string, @ActiveOrganizationId() organizationId: string | undefined) {
        return this.trashService.purge(TrashService.assertEntity(entity), id, this.requireOrganizationId(organizationId));
    }
}
