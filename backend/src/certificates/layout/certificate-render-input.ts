// backend/src/certificates/layout/certificate-render-input.ts
//
// Monta o que o gerador de PDF precisa (CertificateRenderInput) a partir dos dados
// do certificado — tanto para o certificado de verdade quanto para a
// pré-visualização com aluno de exemplo, para as duas usarem exatamente as mesmas
// variáveis.

import { formatAppDate } from '../../common/datetime';
import { formatCertificateCode } from '../certificate-code';
import type { CertificateRenderInput } from '../certificate-pdf.service';
import { CertificateLayout } from './certificate-layout.types';
import { CertificateVariables, dateInFull, formatWorkload, joinNames } from './certificate-layout-variables';

export interface CertificateRenderSource {
    studentName: string;
    organizationName: string;
    course: {
        title: string;
        certificateTitle: string | null;
        category: string | null;
        workloadHours: number | null;
        location: string | null;
        startDate: Date;
        endDate: Date | null;
        syllabus: string | null;
        instructorNames: string[];
    };
    issuedAt: Date;
    expiresAt: Date | null;
    /** Código cru, como guardado no banco */
    code: string;
}

export interface CertificateBrand {
    logoUrl?: string | null;
    signatureName?: string | null;
    signatureImageUrl?: string | null;
}

export function buildCertificateVariables(source: CertificateRenderSource, validationPageUrl: string): CertificateVariables {
    const { course } = source;
    const start = formatAppDate(course.startDate);
    const endLabel = course.endDate ? formatAppDate(course.endDate) : '';
    const end = endLabel && endLabel !== start ? endLabel : '';
    const issued = formatAppDate(source.issuedAt);

    return {
        'aluno.nome': source.studentName,
        'curso.nome': course.certificateTitle?.trim() || course.title,
        'turma.nome': course.title,
        'curso.categoria': course.category ?? '',
        'curso.cargaHoraria': formatWorkload(course.workloadHours),
        'curso.periodo': end ? `de ${start} a ${end}` : `em ${start}`,
        'curso.inicio': start,
        'curso.fim': end || start,
        'curso.local': course.location ?? '',
        'curso.instrutores': joinNames(course.instructorNames),
        'academia.nome': source.organizationName,
        'certificado.emissao': issued,
        'certificado.emissaoExtenso': dateInFull(issued),
        'certificado.validade': source.expiresAt ? formatAppDate(source.expiresAt) : '',
        'certificado.codigo': formatCertificateCode(source.code),
        'certificado.urlValidacao': validationPageUrl,
    };
}

export function buildRenderInput(
    source: CertificateRenderSource,
    layout: CertificateLayout,
    brand: CertificateBrand,
    frontendUrl: string,
): CertificateRenderInput {
    const pageUrl = `${frontendUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')}/validar`;
    return {
        layout,
        variables: buildCertificateVariables(source, pageUrl),
        brand: { organizationName: source.organizationName, ...brand },
        verification: {
            url: `${frontendUrl.replace(/\/$/, '')}/validar/${source.code}`,
            code: formatCertificateCode(source.code),
            pageUrl,
        },
        syllabus: source.course.syllabus,
    };
}
