// frontend/src/services/media.ts
// Cliente do fluxo de upload direto via presigned URL (backend/src/media).
// O PUT do arquivo em si vai direto para o storage (R2), não para a nossa
// API — por isso usa `axios` puro, sem o interceptor de auth/baseURL de `api`.

import axios from 'axios';
import { api } from './api';

export type UploadContext =
    | 'organization-branding'
    | 'course-lessons'
    | 'certificates'
    | 'external-certifications'
    | 'event-files'
    | 'avatars';

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
