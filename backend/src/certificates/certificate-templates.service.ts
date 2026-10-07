import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CertificateTemplate, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertCertificateTemplateDto } from './dto/upsert-certificate-template.dto';
import { PreviewCertificateDto } from './dto/preview-certificate.dto';
import { CertificatePdfService } from './certificate-pdf.service';
import { CertificateLayout } from './layout/certificate-layout.types';
import { LayoutValidationError, parseCertificateLayout } from './layout/certificate-layout.validation';
import { buildClassicLayout } from './layout/classic-layout';
import { CERTIFICATE_VARIABLES } from './layout/certificate-layout-variables';
import { CertificateRenderSource, buildRenderInput } from './layout/certificate-render-input';

const PREVIEW_CODE = 'AB3K9X2MQ7TD';

@Injectable()
export class CertificateTemplatesService {
    private readonly logger = new Logger(CertificateTemplatesService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly pdfService: CertificatePdfService,
        private readonly configService: ConfigService,
    ) {}

    get frontendUrl() {
        return this.configService.get<string>('FRONTEND_URL') || 'http://localhost:5173';
    }

    /** Personalização + layout efetivo (o salvo, ou o Clássico quando não há). */
    async findOne(organizationId: string) {
        const template = await this.prisma.certificateTemplate.findUnique({ where: { organizationId } });
        return {
            organizationId,
            logoUrl: template?.logoUrl ?? null,
            signatureName: template?.signatureName ?? null,
            signatureImageUrl: template?.signatureImageUrl ?? null,
            layout: this.resolveLayout(template),
            isDefaultLayout: !template?.layoutConfig,
        };
    }

    async upsert(organizationId: string, dto: UpsertCertificateTemplateDto) {
        const { layoutConfig, ...fields } = dto;
        // `null` volta para o Clássico; ausente mantém o que estiver salvo.
        const layout =
            layoutConfig === undefined ? undefined : layoutConfig === null ? Prisma.DbNull : (this.parseLayout(layoutConfig) as unknown as Prisma.InputJsonValue);

        await this.prisma.certificateTemplate.upsert({
            where: { organizationId },
            create: { organizationId, ...fields, layoutConfig: layout },
            update: { ...fields, layoutConfig: layout },
        });
        return this.findOne(organizationId);
    }

    /** Layout salvo, validado de novo na leitura: se algo inválido chegou ao banco, cai no Clássico em vez de quebrar a emissão. */
    resolveLayout(template: Pick<CertificateTemplate, 'organizationId' | 'layoutConfig'> | null): CertificateLayout {
        if (!template?.layoutConfig) return buildClassicLayout();
        try {
            return parseCertificateLayout(template.layoutConfig);
        } catch (error) {
            this.logger.warn(`Layout de certificado inválido na academia ${template.organizationId}, usando o Clássico: ${error.message}`);
            return buildClassicLayout();
        }
    }

    private parseLayout(input: unknown): CertificateLayout {
        try {
            return parseCertificateLayout(input);
        } catch (error) {
            if (error instanceof LayoutValidationError) {
                throw new BadRequestException(error.problems);
            }
            throw error;
        }
    }

    getVariables() {
        return CERTIFICATE_VARIABLES;
    }

    /**
     * PDF de exemplo com o layout e a personalização informados (ainda não salvos) ou os
     * salvos. Com `courseId`, usa os dados reais da turma (nome no certificado, carga
     * horária, instrutores, conteúdo programático) e um aluno de exemplo.
     */
    async preview(organizationId: string, dto: PreviewCertificateDto): Promise<Buffer> {
        const [template, organization] = await Promise.all([
            this.prisma.certificateTemplate.findUnique({ where: { organizationId } }),
            this.prisma.organization.findUniqueOrThrow({ where: { id: organizationId }, select: { name: true } }),
        ]);
        const layout = dto.layout ? this.parseLayout(dto.layout) : this.resolveLayout(template);
        const brand = {
            logoUrl: dto.logoUrl !== undefined ? dto.logoUrl : template?.logoUrl,
            signatureName: dto.signatureName !== undefined ? dto.signatureName : template?.signatureName,
            signatureImageUrl: dto.signatureImageUrl !== undefined ? dto.signatureImageUrl : template?.signatureImageUrl,
        };

        const source = dto.courseId ? await this.previewSourceFromCourse(organizationId, dto.courseId, organization.name) : this.sampleSource(organization.name);
        return this.pdfService.generate(buildRenderInput(source, layout, brand, this.frontendUrl));
    }

    private sampleSource(organizationName: string): CertificateRenderSource {
        const today = new Date();
        const start = new Date(today.getTime() - 4 * 86_400_000);
        return {
            studentName: 'Maria da Silva Santos',
            organizationName,
            course: {
                title: 'Brigada de Incêndio — Turma de exemplo',
                certificateTitle: 'Formação de Brigada de Incêndio — Nível Intermediário',
                category: 'Brigada de Incêndio',
                workloadHours: 20,
                location: 'Sede da academia',
                startDate: start,
                endDate: today,
                syllabus: 'Módulo 1 — Prevenção e combate a incêndio\n• Teoria do fogo\n• Classes de incêndio e agentes extintores\n\nMódulo 2 — Primeiros socorros\n• Avaliação inicial da vítima\n• RCP e uso do DEA',
                instructorNames: ['Carlos Lima', 'Ana Souza'],
            },
            issuedAt: today,
            expiresAt: new Date(today.getTime() + 365 * 86_400_000),
            code: PREVIEW_CODE,
        };
    }

    private async previewSourceFromCourse(organizationId: string, courseId: string, organizationName: string): Promise<CertificateRenderSource> {
        const course = await this.prisma.course.findFirst({
            where: { id: courseId, organizationId },
            include: { event: true, instructors: { include: { user: { select: { name: true } } } } },
        });
        if (!course) throw new NotFoundException('Turma não encontrada nesta organização.');

        const sample = this.sampleSource(organizationName);
        const issuedAt = new Date();
        return {
            ...sample,
            course: {
                title: course.event.title,
                certificateTitle: course.certificateTitle,
                category: course.category,
                workloadHours: course.workloadHours,
                location: course.event.location,
                startDate: course.event.startDate,
                endDate: course.event.endDate,
                syllabus: course.syllabus,
                instructorNames: course.instructors.map((instructor) => instructor.user.name),
            },
            issuedAt,
            expiresAt: course.recyclingValidityMonths ? new Date(new Date(issuedAt).setMonth(issuedAt.getMonth() + course.recyclingValidityMonths)) : null,
        };
    }
}
