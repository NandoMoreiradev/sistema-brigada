// backend/src/courses/rooms.controller.ts
//
// Sem DELETE de verdade: uma sala pode ter sessões de aula históricas
// vinculadas (`ClassSession.roomId`), então "remover" é só desativar
// (`active: false` via PATCH) — mantém o histórico legível.

import { Controller, Get, Post, Body, Patch, Param, UseGuards, BadRequestException } from '@nestjs/common';
import { RoomsService } from './rooms.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { RolesGuard } from '../auth/guard/roles.guard';
import { Roles } from '../auth/decorator/roles.decorator';
import { Role } from '@prisma/client';
import { ActiveOrganizationId } from '../auth/common/active-organization-id.decorator';

const ADMIN_ROLES = [Role.SUPER_ADMIN, Role.GROUP_ADMIN, Role.ORG_ADMIN] as const;

@Controller('rooms')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RoomsController {
    constructor(private readonly roomsService: RoomsService) {}

    private requireOrganizationId(organizationId: string | undefined): string {
        if (!organizationId) {
            throw new BadRequestException('Selecione uma organização ativa para gerenciar salas.');
        }
        return organizationId;
    }

    @Post()
    @Roles(...ADMIN_ROLES)
    create(@Body() dto: CreateRoomDto, @ActiveOrganizationId() organizationId: string | undefined) {
        return this.roomsService.create(dto, this.requireOrganizationId(organizationId));
    }

    @Get()
    @Roles(Role.SUPER_ADMIN, Role.GROUP_ADMIN, Role.ORG_ADMIN, Role.ORG_USER)
    findAll(@ActiveOrganizationId() organizationId: string | undefined) {
        return this.roomsService.findAll(this.requireOrganizationId(organizationId));
    }

    @Patch(':id')
    @Roles(...ADMIN_ROLES)
    update(
        @Param('id') id: string,
        @Body() dto: UpdateRoomDto,
        @ActiveOrganizationId() organizationId: string | undefined,
    ) {
        return this.roomsService.update(id, this.requireOrganizationId(organizationId), dto);
    }
}
