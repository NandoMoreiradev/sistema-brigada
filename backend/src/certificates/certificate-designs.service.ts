// backend/src/certificates/certificate-designs.service.ts
//
// Modelos de certificado da academia (CertificateDesign). Qual layout um
// certificado usa: o modelo escolhido na turma → o padrão da academia → o
// Clássico embutido. "Padrão" é único por academia, garantido aqui (trocar o
// padrão desmarca o anterior na mesma transação).

import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CertificateDesign, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CertificateLayout } from './layout/certificate-layout.types';
import { LayoutValidationError, parseCertificateLayout } from './layout/certificate-layout.validation';
import { buildClassicLayout } from './layout/classic-layout';
import { getLayoutPresets } from './layout/layout-presets';
import { CreateCertificateDesignDto, UpdateCertificateDesignDto } from './dto/certificate-design.dto';

const MAX_DESIGNS = 30;

@Injectable()
export class CertificateDesignsService {
    private readonly logger = new Logger(CertificateDesignsService.name);

    constructor(private readonly prisma: PrismaService) {}

    async list(organizationId: string) {
        const designs = await this.prisma.certificateDesign.findMany({
            where: { organizationId },
            include: { _count: { select: { courses: true } } },
            orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
        });
        return designs.map((design) => this.serialize(design, design._count.courses));
    }

    async findOne(id: string, organizationId: string) {
        const design = await this.prisma.certificateDesign.findFirst({
            where: { id, organizationId },
            include: { _count: { select: { courses: true } } },
        });
        if (!design) throw new NotFoundException('Modelo de certificado não encontrado nesta academia.');
        return this.serialize(design, design._count.courses);
    }

    /** Novo modelo: a partir de um modelo pronto, de uma cópia de outro, ou de um layout enviado. */
    async create(organizationId: string, dto: CreateCertificateDesignDto) {
        const count = await this.prisma.certificateDesign.count({ where: { organizationId } });
        if (count >= MAX_DESIGNS) {
            throw new BadRequestException(`Use no máximo ${MAX_DESIGNS} modelos de certificado.`);
        }

        let layout: CertificateLayout;
        if (dto.layout) {
            layout = this.parseLayout(dto.layout);
        } else if (dto.duplicateFromId) {
            layout = (await this.findOne(dto.duplicateFromId, organizationId)).layout;
        } else {
            const preset = getLayoutPresets().find((p) => p.id === (dto.presetId ?? 'classic'));
            if (!preset) throw new BadRequestException('Modelo pronto desconhecido.');
            layout = preset.layout;
        }

        // O primeiro modelo da academia já nasce padrão: senão os certificados seguiriam no Clássico sem ninguém perceber.
        const design = await this.prisma.certificateDesign.create({
            data: { organizationId, name: dto.name.trim(), layout: layout as unknown as Prisma.InputJsonValue, isDefault: count === 0 },
        });
        return this.findOne(design.id, organizationId);
    }

    async update(id: string, organizationId: string, dto: UpdateCertificateDesignDto) {
        await this.findOne(id, organizationId);
        await this.prisma.certificateDesign.update({
            where: { id },
            data: {
                name: dto.name?.trim(),
                layout: dto.layout ? (this.parseLayout(dto.layout) as unknown as Prisma.InputJsonValue) : undefined,
            },
        });
        return this.findOne(id, organizationId);
    }

    async setDefault(id: string, organizationId: string) {
        await this.findOne(id, organizationId);
        await this.prisma.$transaction([
            this.prisma.certificateDesign.updateMany({ where: { organizationId, isDefault: true, id: { not: id } }, data: { isDefault: false } }),
            this.prisma.certificateDesign.update({ where: { id }, data: { isDefault: true } }),
        ]);
        return this.list(organizationId);
    }

    /** As turmas que usavam o modelo voltam para o padrão (FK SetNull). Excluir o padrão faz a academia voltar ao Clássico. */
    async remove(id: string, organizationId: string) {
        await this.findOne(id, organizationId);
        await this.prisma.certificateDesign.delete({ where: { id } });
        return { id };
    }

    async assertBelongs(id: string, organizationId: string) {
        const exists = await this.prisma.certificateDesign.count({ where: { id, organizationId } });
        if (!exists) throw new BadRequestException('O modelo de certificado escolhido não existe nesta academia.');
    }

    /** Layout que vale para um certificado de uma turma (ou para a academia, sem turma). */
    async resolveLayout(organizationId: string, courseDesignId?: string | null): Promise<{ layout: CertificateLayout; designId: string | null }> {
        const design =
            (courseDesignId && (await this.prisma.certificateDesign.findFirst({ where: { id: courseDesignId, organizationId } }))) ||
            (await this.prisma.certificateDesign.findFirst({ where: { organizationId, isDefault: true } }));
        return { layout: this.safeLayout(design), designId: design?.id ?? null };
    }

    /** Validado de novo na leitura: se algo inválido chegou ao banco, cai no Clássico em vez de quebrar a emissão. */
    private safeLayout(design: CertificateDesign | null): CertificateLayout {
        if (!design) return buildClassicLayout();
        try {
            return parseCertificateLayout(design.layout);
        } catch (error) {
            this.logger.warn(`Modelo de certificado ${design.id} inválido, usando o Clássico: ${error.message}`);
            return buildClassicLayout();
        }
    }

    parseLayout(input: unknown): CertificateLayout {
        try {
            return parseCertificateLayout(input);
        } catch (error) {
            if (error instanceof LayoutValidationError) throw new BadRequestException(error.problems);
            throw error;
        }
    }

    private serialize(design: CertificateDesign, coursesCount: number) {
        return {
            id: design.id,
            name: design.name,
            isDefault: design.isDefault,
            layout: this.safeLayout(design),
            coursesCount,
            createdAt: design.createdAt,
            updatedAt: design.updatedAt,
        };
    }
}
