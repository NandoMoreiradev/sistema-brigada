import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// Node 25+ expõe um `localStorage` global experimental que, sem `--localstorage-file`, vale
// `undefined` e esconde o do jsdom (`localStorage.clear()` quebrava todos os testes). Quando isso
// acontecer, instala um Storage em memória equivalente.
function ensureStorage(name: 'localStorage' | 'sessionStorage') {
    let working = false;
    try {
        working = typeof (globalThis as any)[name]?.clear === 'function';
    } catch {
        working = false;
    }
    if (working) return;
    const data = new Map<string, string>();
    const storage = {
        get length() { return data.size; },
        key: (index: number) => Array.from(data.keys())[index] ?? null,
        getItem: (key: string) => (data.has(key) ? data.get(key)! : null),
        setItem: (key: string, value: string) => { data.set(key, String(value)); },
        removeItem: (key: string) => { data.delete(key); },
        clear: () => { data.clear(); },
    };
    Object.defineProperty(globalThis, name, { value: storage, configurable: true, writable: true });
    if (typeof window !== 'undefined') Object.defineProperty(window, name, { value: storage, configurable: true, writable: true });
}
ensureStorage('localStorage');
ensureStorage('sessionStorage');

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
