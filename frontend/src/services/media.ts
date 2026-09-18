// frontend/src/services/media.ts
//
// Cliente mínimo para /media/presigned-url (backend/src/media). Portado do
// mediaService.ts da MaskotCrmEdu — mesmo fluxo de upload em 2 passos: 1) pede
// uma URL assinada ao backend (autenticado, via `api`), 2) faz o PUT direto
// pro storage usando `fetch` puro (a URL assinada não aceita os headers que o
// axios `api` adicionaria automaticamente).

import { api } from './api';

export interface PresignedUrlResponse {
    signedUrl: string;
    fileUrl: string;
    storageKey?: string;
}

// Mantém só os contextos usados hoje pelo frontend (backend aceita mais,
// ver backend/src/media/dto/generate-presigned-url.dto.ts).
export type UploadContext = 'email-templates';

/**
 * Solicita uma URL pré-assinada do backend para fazer upload de um arquivo.
 */
export const getPresignedUrl = async (
    file: File,
    context: UploadContext
): Promise<PresignedUrlResponse> => {
    const { name, type, size } = file;

    const { data } = await api.post<PresignedUrlResponse>('/media/presigned-url', {
        fileName: name,
        contentType: type,
        context,
        fileSize: size,
    });

    return data;
};

export const uploadFileToPresignedUrl = async (signedUrl: string, file: File): Promise<Response> => {
    const response = await fetch(signedUrl, {
        method: 'PUT',
        body: file,
        headers: {
            'Content-Type': file.type,
        },
    });

    if (!response.ok) {
        throw new Error('Falha no upload do arquivo para o storage.');
    }

    return response;
};
