// frontend/src/pages/event-detail/PrintPortal.tsx
//
// Imprime só o `children` (sem nav, abas e botões): renderiza num portal anexado ao body e liga
// `body.is-printing` (ver GlobalStyle.ts). Espera as imagens (planta baixa) carregarem antes de
// abrir a impressão — senão o mapa sai em branco.

import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { waitForImages } from '@/utils/dom';

interface PrintPortalProps {
    /** Quando vira `true`, dispara a impressão uma única vez. */
    active: boolean;
    orientation?: 'landscape' | 'portrait';
    onFinished: () => void;
    children: ReactNode;
}

export function PrintPortal({ active, orientation = 'landscape', onFinished, children }: PrintPortalProps) {
    useEffect(() => {
        if (!active) return;
        let cancelled = false;

        (async () => {
            await waitForImages(document.getElementById('print-portal'));
            if (cancelled) return;

            const style = document.createElement('style');
            // html/body/#root têm height:100% no CSS global; sem liberar, o navegador imprime só a 1ª página.
            style.textContent = `@page { size: A4 ${orientation}; margin: 8mm; } @media print { html, body { height: auto !important; overflow: visible !important; } }`;
            document.head.appendChild(style);
            document.body.classList.add('is-printing');

            const cleanup = () => {
                document.body.classList.remove('is-printing');
                style.remove();
                window.removeEventListener('afterprint', cleanup);
                onFinished();
            };
            window.addEventListener('afterprint', cleanup);
            window.print();
        })();

        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [active]);

    return createPortal(<div id="print-portal">{children}</div>, document.body);
}
