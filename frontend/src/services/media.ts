// frontend/src/services/media.ts
//
// Cliente do fluxo de upload direto via presigned URL (backend/src/media).
// O PUT do arquivo em si vai direto para o storage (R2), não para a nossa
// API — por isso usa fetch/axios puro, sem o interceptor de auth/baseURL de `api`.

import axios from 'axios';
import { api } from './api';

export type UploadContext =
    | 'organization-branding'
    | 'course-lessons'
    | 'certificates'
    | 'external-certifications'
    | 'event-files'
    | 'event-floor-plan'
    | 'avatars'
    | 'email-templates'
    | 'occurrence-audio'
    | 'occurrence-files';

export const mediaApi = {
    upload: async (file: File, context: UploadContext) => {
        const { data } = await api.post<{ signedUrl: string; fileUrl: string; storageKey: string }>('/media/presigned-url', {
            fileName: file.name,
            contentType: file.type || 'application/octet-stream',
            context,
            fileSize: file.size,
        });

        await axios.put(data.signedUrl, file, { headers: { 'Content-Type': file.type || 'application/octet-stream' } });

        return { fileUrl: data.fileUrl, storageKey: data.storageKey };
    },
};

export interface PresignedUrlResponse {
    signedUrl: string;
    fileUrl: string;
    storageKey?: string;
}

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
