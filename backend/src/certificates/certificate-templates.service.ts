import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertCertificateTemplateDto } from './dto/upsert-certificate-template.dto';
import { PreviewCertificateDto } from './dto/preview-certificate.dto';
import { CertificatePdfService } from './certificate-pdf.service';
import { CertificateDesignsService } from './certificate-designs.service';
import { CERTIFICATE_VARIABLES } from './layout/certificate-layout-variables';
import { getLayoutPresets } from './layout/layout-presets';
import { CertificateRenderSource, buildRenderInput } from './layout/certificate-render-input';

const PREVIEW_CODE = 'AB3K9X2MQ7TD';

@Injectable()
export class CertificateTemplatesService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly pdfService: CertificatePdfService,
        private readonly designsService: CertificateDesignsService,
        private readonly configService: ConfigService,
    ) {}

    get frontendUrl() {
        return this.configService.get<string>('FRONTEND_URL') || 'http://localhost:5173';
    }

    /** Identidade da academia usada pelos certificados (logo, assinatura) — o layout fica nos modelos (CertificateDesign). */
    async findOne(organizationId: string) {
        const [template, organization, defaultDesign] = await Promise.all([
            this.prisma.certificateTemplate.findUnique({ where: { organizationId } }),
            this.prisma.organization.findUnique({ where: { id: organizationId }, select: { name: true } }),
            this.prisma.certificateDesign.findFirst({ where: { organizationId, isDefault: true }, select: { id: true } }),
        ]);
        return {
            organizationId,
            // O editor visual usa nas iniciais do selo e na variável {{academia.nome}}.
            organizationName: organization?.name ?? '',
            logoUrl: template?.logoUrl ?? null,
            signatureName: template?.signatureName ?? null,
            signatureImageUrl: template?.signatureImageUrl ?? null,
            defaultDesignId: defaultDesign?.id ?? null,
        };
    }

    async upsert(organizationId: string, dto: UpsertCertificateTemplateDto) {
        await this.prisma.certificateTemplate.upsert({
            where: { organizationId },
            create: { organizationId, ...dto },
            update: dto,
        });
        return this.findOne(organizationId);
    }

    getVariables() {
        return CERTIFICATE_VARIABLES;
    }

    getPresets() {
        return getLayoutPresets();
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
        const layout = await this.previewLayout(organizationId, dto);
        const brand = {
            logoUrl: dto.logoUrl !== undefined ? dto.logoUrl : template?.logoUrl,
            signatureName: dto.signatureName !== undefined ? dto.signatureName : template?.signatureName,
            signatureImageUrl: dto.signatureImageUrl !== undefined ? dto.signatureImageUrl : template?.signatureImageUrl,
        };

        const source = dto.courseId ? await this.previewSourceFromCourse(organizationId, dto.courseId, organization.name) : this.sampleSource(organization.name);
        return this.pdfService.generate(buildRenderInput(source, layout, brand, this.frontendUrl));
    }

    /** O layout enviado (não salvo) → o modelo escolhido → o modelo da turma → o padrão. */
    private async previewLayout(organizationId: string, dto: PreviewCertificateDto) {
        if (dto.layout) return this.designsService.parseLayout(dto.layout);
        if (dto.designId) return (await this.designsService.findOne(dto.designId, organizationId)).layout;
        const course = dto.courseId
            ? await this.prisma.course.findFirst({ where: { id: dto.courseId, organizationId }, select: { certificateDesignId: true } })
            : null;
        return (await this.designsService.resolveLayout(organizationId, course?.certificateDesignId)).layout;
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
