// backend/src/media/media.controller.ts
//
// Adaptado de maskotCrmEdu/backend/src/media/media.controller.ts. Removido
// StorageLimitGuard (cota de armazenamento por plano — não existe neste
// projeto). Roles trocados para o enum novo (SUPER_ADMIN/GROUP_ADMIN/
// ORG_ADMIN/ORG_USER) e uploadLogo virou upload de branding da organização.

import { Controller, Post, UploadedFile, UseInterceptors, UseGuards, BadRequestException, Body } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { MediaService } from './media.service';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { RolesGuard } from '../auth/guard/roles.guard';
import { Roles } from '../auth/decorator/roles.decorator';
import { Role } from '@prisma/client';
import { GeneratePresignedUrlDto } from './dto/generate-presigned-url.dto';
import { ActiveOrganizationId } from '../auth/common/active-organization-id.decorator';
import { CurrentUser } from '../auth/common/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';

@Controller('media')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MediaController {
    constructor(private readonly mediaService: MediaService) {}

    @Post('presigned-url')
    @Roles(Role.SUPER_ADMIN, Role.GROUP_ADMIN, Role.ORG_ADMIN, Role.ORG_USER)
    async getPresignedUrl(
        @Body() generatePresignedUrlDto: GeneratePresignedUrlDto,
        @ActiveOrganizationId() activeOrganizationId: string | undefined,
        @CurrentUser() user: AuthenticatedUser,
    ) {
        let targetOrganizationId: string | null = activeOrganizationId || null;

        if (!targetOrganizationId) {
            if (user.role === Role.SUPER_ADMIN) {
                targetOrganizationId = null;
            } else {
                throw new BadRequestException('Não foi possível determinar a organização ativa para o upload.');
            }
        }

        return this.mediaService.generatePresignedUrl(generatePresignedUrlDto, targetOrganizationId);
    }

    @Post('upload-branding')
    @Roles(Role.SUPER_ADMIN, Role.GROUP_ADMIN, Role.ORG_ADMIN)
    @UseInterceptors(FileInterceptor('file'))
    async uploadBranding(@UploadedFile() file: Express.Multer.File) {
        if (!file) {
            throw new BadRequestException('Nenhum arquivo foi enviado.');
        }

        const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
        if (!allowedMimes.includes(file.mimetype)) {
            throw new BadRequestException(`Tipo de arquivo inválido (${file.mimetype}). Aceitamos apenas: PNG, JPG, WEBP ou SVG.`);
        }

        const maxSize = 1024 * 1024 * 2;
        if (file.size > maxSize) {
            throw new BadRequestException('O arquivo é muito grande. O tamanho máximo permitido é 2MB.');
        }

        return this.mediaService.uploadFileFromBuffer(file.buffer, file.originalname, file.mimetype, 'organization-branding');
    }
}
