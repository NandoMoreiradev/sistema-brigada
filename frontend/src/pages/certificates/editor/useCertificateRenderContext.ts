// frontend/src/pages/certificates/editor/useCertificateRenderContext.ts
//
// Contexto de desenho de um layout fora do PDF (editor, miniaturas): identidade da
// academia + variáveis com os valores de exemplo.

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { certificateTemplateApi } from '@/services/certificates';
import type { RenderContext } from './ElementView';

export type BaseRenderContext = Omit<RenderContext, 'scale' | 'layout'>;

const SAMPLE_CODE = 'AB3K9X2MQ7TD';

/** Ementa de exemplo para o bloco de conteúdo programático no editor (no PDF vem a da turma). */
const SAMPLE_SYLLABUS = [
    'MÓDULO 1 — PREVENÇÃO E COMBATE A INCÊNDIO',
    '• Teoria do fogo e triângulo do fogo',
    '• Classes de incêndio e agentes extintores',
    '• Métodos de extinção',
    '• Extintores portáteis, hidrantes e mangotinhos',
    '• Prática com fogo real',
    '',
    'MÓDULO 2 — PRIMEIROS SOCORROS',
    '• Avaliação da cena e biossegurança',
    '• Avaliação primária (XABCDE)',
    '• RCP e uso do DEA',
    '• Obstrução de vias aéreas',
    '• Hemorragias, queimaduras e imobilizações',
    '',
    'MÓDULO 3 — ABANDONO DE ÁREA',
    '• Plano de emergência e rotas de fuga',
    '• Pontos de encontro e contagem',
    '• Simulado de abandono',
].join('\n');

/** Identidade da academia + variáveis de exemplo, para desenhar um layout fora do PDF. */
export function useCertificateRenderContext(showVariables = false) {
    const { data: template } = useQuery({ queryKey: ['certificate-template'], queryFn: () => certificateTemplateApi.get() });
    const { data: variables = [] } = useQuery({ queryKey: ['certificate-variables'], queryFn: () => certificateTemplateApi.variables() });

    const ctx = useMemo<BaseRenderContext>(() => {
        const sample = Object.fromEntries(variables.map((variable) => [variable.key, variable.example]));
        if (template?.organizationName) sample['academia.nome'] = template.organizationName;
        return {
            variables: sample,
            showVariables,
            brand: {
                organizationName: template?.organizationName ?? '',
                logoUrl: template?.logoUrl ?? null,
                signatureName: template?.signatureName ?? null,
                signatureImageUrl: template?.signatureImageUrl ?? null,
            },
            sampleSyllabus: SAMPLE_SYLLABUS,
            verification: { url: `${window.location.origin}/validar/${SAMPLE_CODE}`, code: 'AB3K-9X2M-Q7TD', pageUrl: `${window.location.host}/validar` },
        };
    }, [variables, template, showVariables]);

    return { ctx, template, variables };
}
