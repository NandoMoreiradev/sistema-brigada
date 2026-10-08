// frontend/src/components/ui/scrollFade.ts
//
// Linha de abas (ou de filtros) que rola na horizontal no celular: sem pista nenhuma a última aba
// aparece cortada e ninguém percebe que há mais. `useScrollFade` marca no elemento se há conteúdo
// escondido de cada lado (data-fade-start / data-fade-end) e `scrollFade` esmaece essa borda.
// A aba ativa também é trazida para a vista, para quem abre a tela por um link com ?tab=.

import { useCallback, useEffect, useRef } from 'react';
import { css } from 'styled-components';

const EDGE_TOLERANCE = 4;

function revealActive(element: HTMLElement | null) {
    element?.querySelector('[data-state="active"]')?.scrollIntoView?.({ block: 'nearest', inline: 'center' });
}

/**
 * Devolve uma ref de callback (e não um objeto) porque a linha de abas muitas vezes só aparece
 * depois que a tela carrega os dados: o efeito de montagem do componente rodaria cedo demais.
 */
export function useScrollFade<T extends HTMLElement>(activeValue?: string) {
    const elementRef = useRef<T | null>(null);
    const detachRef = useRef<(() => void) | null>(null);

    const ref = useCallback((element: T | null) => {
        detachRef.current?.();
        detachRef.current = null;
        elementRef.current = element;
        if (!element) return;

        const update = () => {
            element.dataset.fadeStart = String(element.scrollLeft > EDGE_TOLERANCE);
            element.dataset.fadeEnd = String(element.scrollLeft + element.clientWidth < element.scrollWidth - EDGE_TOLERANCE);
        };
        update();
        revealActive(element);
        element.addEventListener('scroll', update, { passive: true });
        const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
        observer?.observe(element);
        detachRef.current = () => {
            element.removeEventListener('scroll', update);
            observer?.disconnect();
        };
    }, []);

    useEffect(() => revealActive(elementRef.current), [activeValue]);

    return ref;
}

/** Aplicar no elemento que recebe a ref de `useScrollFade` (com overflow-x: auto). */
export const scrollFade = css`
    &[data-fade-start='true'] {
        mask-image: linear-gradient(to right, transparent, #000 28px);
    }

    &[data-fade-end='true'] {
        mask-image: linear-gradient(to left, transparent, #000 28px);
    }

    &[data-fade-start='true'][data-fade-end='true'] {
        mask-image: linear-gradient(to right, transparent, #000 28px, #000 calc(100% - 28px), transparent);
    }
`;
