import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// Desmonta o que ficou entre testes. Sem isto, componentes de um teste vazam
// para o seguinte e as buscas passam a encontrar mais de um elemento.
afterEach(() => {
    cleanup();
    localStorage.clear();
    vi.clearAllMocks();
});

// `ResizeObserver` não existe no jsdom. O stub não dispara callbacks.
class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
}
if (!('ResizeObserver' in globalThis)) {
    (globalThis as any).ResizeObserver = ResizeObserverStub;
}

// `matchMedia` não existe no jsdom e é consultado por bibliotecas de layout
// durante a montagem.
Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
    }),
});
