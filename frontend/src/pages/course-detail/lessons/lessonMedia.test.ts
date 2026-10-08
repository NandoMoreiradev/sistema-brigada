import { describe, expect, it } from 'vitest';
import { embeddedVideoFor, fileExtension, formatFileSize, formatLessonDuration, materialKind } from './lessonMedia';

describe('embeddedVideoFor', () => {
    it('reconhece os formatos de link do YouTube', () => {
        const expected = 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0';
        expect(embeddedVideoFor('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10s')?.embedUrl).toBe(expected);
        expect(embeddedVideoFor('https://youtu.be/dQw4w9WgXcQ')?.embedUrl).toBe(expected);
        expect(embeddedVideoFor('https://m.youtube.com/shorts/dQw4w9WgXcQ')?.embedUrl).toBe(expected);
        expect(embeddedVideoFor('https://www.youtube.com/embed/dQw4w9WgXcQ')?.embedUrl).toBe(expected);
    });

    it('reconhece Vimeo', () => {
        expect(embeddedVideoFor('https://vimeo.com/123456789')).toEqual({ provider: 'Vimeo', embedUrl: 'https://player.vimeo.com/video/123456789' });
    });

    it('não embute o que não conhece nem links malformados', () => {
        expect(embeddedVideoFor('https://example.com/video.mp4')).toBeNull();
        expect(embeddedVideoFor('https://www.youtube.com/watch?v=curto')).toBeNull();
        expect(embeddedVideoFor('https://evil.com/?u=https://youtu.be/dQw4w9WgXcQ')).toBeNull();
        expect(embeddedVideoFor('javascript:alert(1)')).toBeNull();
        expect(embeddedVideoFor('não é url')).toBeNull();
    });
});

describe('materialKind', () => {
    it('usa o mime quando existe', () => {
        expect(materialKind('image/png', 'x')).toBe('image');
        expect(materialKind('audio/mpeg', 'x')).toBe('audio');
        expect(materialKind('application/pdf', 'x')).toBe('pdf');
        expect(materialKind('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'x')).toBe('excel');
        expect(materialKind('application/vnd.openxmlformats-officedocument.presentationml.presentation', 'x')).toBe('powerpoint');
    });

    it('cai para a extensão sem mime útil', () => {
        expect(materialKind(null, 'Apostila.PDF')).toBe('pdf');
        expect(materialKind('application/octet-stream', 'planilha.xlsx')).toBe('excel');
        expect(materialKind(null, 'sem-extensao')).toBe('file');
    });
});

describe('formatadores', () => {
    it('formata a duração guardada em segundos', () => {
        expect(formatLessonDuration(null)).toBe('');
        expect(formatLessonDuration(20)).toBe('1 min');
        expect(formatLessonDuration(18 * 60)).toBe('18 min');
        expect(formatLessonDuration(60 * 60)).toBe('1 h');
        expect(formatLessonDuration(65 * 60)).toBe('1 h 05 min');
    });

    it('formata o tamanho do arquivo', () => {
        expect(formatFileSize(null)).toBe('');
        expect(formatFileSize(48211)).toBe('47 KB');
        expect(formatFileSize(2411724)).toBe('2,3 MB');
    });

    it('extrai a extensão', () => {
        expect(fileExtension('a.b.docx')).toBe('docx');
        expect(fileExtension('.gitignore')).toBe('');
        expect(fileExtension('fim.')).toBe('');
    });
});
