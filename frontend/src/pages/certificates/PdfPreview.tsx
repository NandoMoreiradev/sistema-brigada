// frontend/src/pages/certificates/PdfPreview.tsx
//
// Pré-visualização do certificado em PDF, compartilhada pelo "Personalizar" e pelo
// editor visual: gera no backend (mesmo gerador dos certificados de verdade) e
// mostra num modal.

import { useEffect, useState } from 'react';
import styled from 'styled-components';
import { useMutation } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { Modal } from '@/components/ui/Modal';
import { certificateTemplateApi } from '@/services/certificates';
import { toast } from '@/utils/toast';

const PdfFrame = styled.iframe`
    width: 100%;
    height: min(75vh, 680px);
    border: 1px solid ${({ theme }) => theme.colors.borderLight};
    border-radius: ${({ theme }) => theme.radii.sm};
    background: ${({ theme }) => theme.colors.lightGray};
`;

/** Mensagem do backend — inclusive quando a resposta era `blob` (a pré-visualização), em que o JSON de erro vem dentro do Blob. */
export async function certificateErrorMessage(error: unknown, fallback: string): Promise<string> {
    if (!isAxiosError(error)) return fallback;
    let data = error.response?.data;
    if (data instanceof Blob) {
        try {
            data = JSON.parse(await data.text());
        } catch {
            return fallback;
        }
    }
    const message = data?.message;
    if (Array.isArray(message)) return message.slice(0, 3).join(' ') + (message.length > 3 ? ` (+${message.length - 3})` : '');
    return message || fallback;
}

type PreviewInput = Parameters<typeof certificateTemplateApi.preview>[0];

export function usePdfPreview() {
    const [url, setUrl] = useState<string | null>(null);

    // Libera o PDF anterior da memória sempre que troca ou fecha.
    useEffect(() => () => {
        if (url) URL.revokeObjectURL(url);
    }, [url]);

    const mutation = useMutation({
        mutationFn: (input: PreviewInput) => certificateTemplateApi.preview(input),
        onSuccess: (blob) => setUrl(URL.createObjectURL(blob)),
        onError: async (error) => toast.error(await certificateErrorMessage(error, 'Não foi possível gerar a pré-visualização.')),
    });

    return {
        generate: mutation.mutate,
        isGenerating: mutation.isPending,
        dialog: (
            <Modal open={!!url} onOpenChange={(open) => !open && setUrl(null)} title="Pré-visualização do certificado" width="960px">
                {url && <PdfFrame src={url} title="Pré-visualização do certificado em PDF" />}
            </Modal>
        ),
    };
}
