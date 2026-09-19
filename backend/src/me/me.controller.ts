// backend/src/me/me.controller.ts
//
// Só JwtAuthGuard — sem RolesGuard/PermissionsGuard: estes endpoints não
// administram a organização, só devolvem o recorte do próprio usuário
// autenticado, então qualquer papel (inclusive ORG_USER sem nenhum cargo)
// pode chamá-los.

import { Controller, Get, UseGuards, BadRequestException } from '@nestjs/common';
import { MeService } from './me.service';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { ActiveOrganizationId } from '../auth/common/active-organization-id.decorator';
import { CurrentUser } from '../auth/common/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';

@Controller('me')
@UseGuards(JwtAuthGuard)
export class MeController {
    constructor(private readonly meService: MeService) {}

    private requireOrganizationId(organizationId: string | undefined): string {
        if (!organizationId) {
            throw new BadRequestException('Selecione uma organização ativa.');
        }
        return organizationId;
    }

    @Get('courses')
    getMyCourses(@CurrentUser() user: AuthenticatedUser, @ActiveOrganizationId() organizationId: string | undefined) {
        return this.meService.getMyCourses(user.id, this.requireOrganizationId(organizationId));
    }

    @Get('enrollments')
    getMyEnrollments(@CurrentUser() user: AuthenticatedUser, @ActiveOrganizationId() organizationId: string | undefined) {
        return this.meService.getMyEnrollments(user.id, this.requireOrganizationId(organizationId));
    }

    @Get('designations')
    getMyDesignations(@CurrentUser() user: AuthenticatedUser, @ActiveOrganizationId() organizationId: string | undefined) {
        return this.meService.getMyDesignations(user.id, this.requireOrganizationId(organizationId));
    }

    @Get('certificates')
    getMyCertificates(@CurrentUser() user: AuthenticatedUser, @ActiveOrganizationId() organizationId: string | undefined) {
        return this.meService.getMyCertificates(user.id, this.requireOrganizationId(organizationId));
    }
}
