// frontend/src/pages/course-detail/lessons/lessonMedia.ts
//
// Funções puras que a tela de vídeo-aulas usa para decidir COMO mostrar cada mídia: link de
// YouTube/Vimeo vira player embutido, arquivo vira imagem/áudio/documento conforme o tipo.

export type MaterialKind = 'image' | 'audio' | 'pdf' | 'word' | 'excel' | 'powerpoint' | 'archive' | 'text' | 'file';

const EXTENSION_KIND: Record<string, MaterialKind> = {
    pdf: 'pdf',
    doc: 'word',
    docx: 'word',
    xls: 'excel',
    xlsx: 'excel',
    csv: 'excel',
    ppt: 'powerpoint',
    pptx: 'powerpoint',
    zip: 'archive',
    txt: 'text',
    jpg: 'image',
    jpeg: 'image',
    png: 'image',
    webp: 'image',
    gif: 'image',
    svg: 'image',
    mp3: 'audio',
    wav: 'audio',
    ogg: 'audio',
    m4a: 'audio',
};

export function fileExtension(name: string): string {
    const dot = name.lastIndexOf('.');
    return dot > 0 && dot < name.length - 1 ? name.slice(dot + 1).toLowerCase() : '';
}

/** Tipo de exibição do anexo. O mime manda; sem mime útil, a extensão do nome decide. */
export function materialKind(mimeType: string | null | undefined, name: string): MaterialKind {
    const mime = (mimeType ?? '').toLowerCase();
    if (mime.startsWith('image/')) return 'image';
    if (mime.startsWith('audio/')) return 'audio';
    if (mime === 'application/pdf') return 'pdf';
    if (mime.includes('wordprocessingml') || mime === 'application/msword') return 'word';
    if (mime.includes('spreadsheetml') || mime === 'application/vnd.ms-excel' || mime === 'text/csv') return 'excel';
    if (mime.includes('presentationml') || mime === 'application/vnd.ms-powerpoint') return 'powerpoint';
    if (mime === 'application/zip' || mime === 'application/x-zip-compressed') return 'archive';
    if (mime === 'text/plain') return 'text';
    return EXTENSION_KIND[fileExtension(name)] ?? 'file';
}

export const MATERIAL_KIND_LABEL: Record<MaterialKind, string> = {
    image: 'Imagem',
    audio: 'Áudio',
    pdf: 'PDF',
    word: 'Word',
    excel: 'Planilha',
    powerpoint: 'Slides',
    archive: 'ZIP',
    text: 'Texto',
    file: 'Arquivo',
};

export function formatFileSize(bytes: number | null | undefined): string {
    if (!bytes) return '';
    if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
}

/** Duração da aula (guardada em segundos): "18 min", "1 h 05 min". Vazio quando não informada. */
export function formatLessonDuration(seconds: number | null | undefined): string {
    if (!seconds || seconds <= 0) return '';
    const minutes = Math.max(1, Math.round(seconds / 60));
    if (minutes < 60) return `${minutes} min`;
    const rest = minutes % 60;
    return `${Math.floor(minutes / 60)} h${rest ? ` ${String(rest).padStart(2, '0')} min` : ''}`;
}

export interface EmbeddedVideo {
    provider: 'YouTube' | 'Vimeo';
    embedUrl: string;
}

/**
 * Link colado que dá para tocar dentro da página (YouTube e Vimeo). Qualquer outro link não é
 * embutível com segurança e continua abrindo em outra aba. Devolve null se não reconhecer.
 */
export function embeddedVideoFor(rawUrl: string): EmbeddedVideo | null {
    let url: URL;
    try {
        url = new URL(rawUrl.trim());
    } catch {
        return null;
    }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    const host = url.hostname.replace(/^(www\.|m\.)/, '');

    if (host === 'youtu.be') {
        const id = url.pathname.split('/')[1];
        return isYouTubeId(id) ? youTube(id) : null;
    }
    if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
        const [, kind, pathId] = url.pathname.split('/');
        const id = kind === 'watch' || url.pathname === '/watch' ? url.searchParams.get('v') : ['embed', 'shorts', 'live'].includes(kind) ? pathId : null;
        return id && isYouTubeId(id) ? youTube(id) : null;
    }
    if (host === 'vimeo.com' || host === 'player.vimeo.com') {
        const id = url.pathname.split('/').filter(Boolean).find((part) => /^\d+$/.test(part));
        return id ? { provider: 'Vimeo', embedUrl: `https://player.vimeo.com/video/${id}` } : null;
    }
    return null;
}

function isYouTubeId(id: string | null | undefined): id is string {
    return !!id && /^[\w-]{11}$/.test(id);
}

function youTube(id: string): EmbeddedVideo {
    return { provider: 'YouTube', embedUrl: `https://www.youtube-nocookie.com/embed/${id}?rel=0` };
}
