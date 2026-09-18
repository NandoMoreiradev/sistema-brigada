// frontend/src/utils/sanitize.ts

import DOMPurify from 'dompurify';

/**
 * Configuração segura do DOMPurify para sanitização de HTML em emails
 */
const SANITIZE_CONFIG = {
    ALLOWED_TAGS: [
        'p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'ul', 'ol', 'li', 'a', 'img', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
        'div', 'span', 'hr'
    ],
    ALLOWED_ATTR: [
        'href', 'src', 'alt', 'title', 'class', 'style', 'target',
        'width', 'height', 'align', 'border', 'cellpadding', 'cellspacing'
    ],
    ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
};

/**
 * Sanitiza HTML para prevenir XSS
 * @param dirty - HTML potencialmente perigoso
 * @returns HTML sanitizado
 */
export function sanitizeHtml(dirty: string): string {
    if (!dirty || typeof dirty !== 'string') {
        return '';
    }

    return DOMPurify.sanitize(dirty, SANITIZE_CONFIG);
}

/**
 * Sanitiza texto simples (escape de HTML)
 * @param text - Texto para escapar
 * @returns Texto com HTML escapado
 */
export function sanitizeText(text: string): string {
    if (!text || typeof text !== 'string') {
        return '';
    }

    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * Valida e sanitiza URL
 * @param url - URL para validar
 * @returns URL sanitizada ou null se inválida
 */
export function sanitizeUrl(url: string): string | null {
    if (!url || typeof url !== 'string') {
        return null;
    }

    const trimmed = url.trim();

    // ✅ VALIDAÇÃO: Permite apenas protocolos seguros
    const SAFE_PROTOCOLS = ['http://', 'https://', 'mailto:', 'tel:', '{{'];

    const isSafe = SAFE_PROTOCOLS.some(protocol => trimmed.startsWith(protocol));

    if (!isSafe && trimmed !== '#' && trimmed !== '') {
        return null;
    }

    try {
        // ✅ VALIDAÇÃO: Verifica se é URL válida (exceto merge tags)
        if (!trimmed.startsWith('{{') && trimmed !== '#') {
            new URL(trimmed);
        }
        return DOMPurify.sanitize(trimmed);
    } catch {
        // Se não for URL válida, retorna null
        return null;
    }
}

/**
 * Sanitiza atributos de estilo CSS
 * @param style - String CSS
 * @returns CSS sanitizado
 */
export function sanitizeStyle(style: string): string {
    if (!style || typeof style !== 'string') {
        return '';
    }

    // ✅ PROTEÇÃO: Remove propriedades perigosas
    const dangerousProps = ['expression', 'behavior', 'javascript:', 'vbscript:'];

    let sanitized = style;
    dangerousProps.forEach(prop => {
        const regex = new RegExp(prop, 'gi');
        sanitized = sanitized.replace(regex, '');
    });

    return DOMPurify.sanitize(sanitized);
}