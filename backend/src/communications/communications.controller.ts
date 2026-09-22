// backend/src/communications/communications.controller.ts
//
// CRUD + envio de "comunicados" (e-mail avulso pra pessoas da própria academia). Mesma
// permissão de email-templates.controller.ts (communications:manage) — as duas telas moram
// juntas em "E-mails e comunicados" no frontend.

import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, UseGuards, BadRequestException } from '@nestjs/common';
import { CommunicationBroadcastService } from './communication-broadcast.service';
import { CreateCommunicationDto } from './dto/create-communication.dto';
import { UpdateCommunicationDto } from './dto/update-communication.dto';
import { ListCommunicationsDto } from './dto/list-communications.dto';
import { SendTestCommunicationDto } from './dto/send-test-communication.dto';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { RolesGuard } from '../auth/guard/roles.guard';
import { PermissionsGuard, RequirePermission } from '../auth/guard/permissions.guard';
import { ActiveOrganizationId } from '../auth/common/active-organization-id.decorator';
import { CurrentUser } from '../auth/common/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';

@Controller('communications')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@RequirePermission('communications:manage')
export class CommunicationsController {
    constructor(private readonly communicationsService: CommunicationBroadcastService) {}

    private requireOrganizationId(organizationId: string | undefined): string {
        if (!organizationId) {
            throw new BadRequestException('Selecione uma academia ativa para gerenciar comunicados.');
        }
        return organizationId;
    }

    @Post()
    create(
        @Body() dto: CreateCommunicationDto,
        @CurrentUser() user: AuthenticatedUser,
        @ActiveOrganizationId() organizationId: string | undefined,
    ) {
        return this.communicationsService.create(dto, this.requireOrganizationId(organizationId), user.id);
    }

    @Get()
    findAll(@Query() query: ListCommunicationsDto, @ActiveOrganizationId() organizationId: string | undefined) {
        return this.communicationsService.findAll(this.requireOrganizationId(organizationId), query);
    }

    @Get(':id')
    findOne(@Param('id') id: string, @ActiveOrganizationId() organizationId: string | undefined) {
        return this.communicationsService.findOne(id, this.requireOrganizationId(organizationId));
    }

    @Patch(':id')
    update(
        @Param('id') id: string,
        @Body() dto: UpdateCommunicationDto,
        @ActiveOrganizationId() organizationId: string | undefined,
    ) {
        return this.communicationsService.update(id, this.requireOrganizationId(organizationId), dto);
    }

    @Delete(':id')
    remove(@Param('id') id: string, @ActiveOrganizationId() organizationId: string | undefined) {
        return this.communicationsService.remove(id, this.requireOrganizationId(organizationId));
    }

    @Post(':id/send')
    @HttpCode(HttpStatus.OK)
    send(@Param('id') id: string, @ActiveOrganizationId() organizationId: string | undefined) {
        return this.communicationsService.send(id, this.requireOrganizationId(organizationId));
    }

    @Post(':id/send-test')
    @HttpCode(HttpStatus.OK)
    sendTest(
        @Param('id') id: string,
        @Body() dto: SendTestCommunicationDto,
        @ActiveOrganizationId() organizationId: string | undefined,
    ) {
        return this.communicationsService.sendTest(id, this.requireOrganizationId(organizationId), dto.to);
    }
}
