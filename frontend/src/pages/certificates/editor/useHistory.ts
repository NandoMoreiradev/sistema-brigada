// frontend/src/pages/certificates/editor/useHistory.ts
//
// Estado com desfazer/refazer. Duas formas de mudar:
// - `set`: cada chamada vira um passo de histórico (trocar uma cor, apagar um elemento).
// - `begin` + `preview` + `end`: para gestos contínuos (arrastar, redimensionar,
//   digitar). Durante o gesto só o estado atual muda; ao terminar, entra UM passo
//   no histórico — senão desfazer um arrasto exigiria dezenas de Ctrl+Z.
//
// As refs são lidas/escritas FORA das funções de atualização do setState: no
// StrictMode o React chama essas funções duas vezes, e um efeito colateral dentro
// delas (zerar a ref do gesto) faria a segunda chamada perder o passo do histórico.

import { useCallback, useEffect, useRef, useState } from 'react';

const LIMIT = 100;

export function useHistory<T>(initial: T) {
    const [state, setState] = useState({ past: [] as T[], present: initial, future: [] as T[] });
    const presentRef = useRef(initial);
    const gestureStart = useRef<T | null>(null);

    useEffect(() => {
        presentRef.current = state.present;
    }, [state.present]);

    const lastCoalesce = useRef<{ key: string; at: number } | null>(null);

    /**
     * `coalesceKey`: mudanças seguidas com a mesma chave em menos de 1s viram UM passo
     * (arrastar o seletor de cor, digitar no nome da camada).
     */
    const set = useCallback((next: T | ((current: T) => T), coalesceKey?: string) => {
        const now = Date.now();
        const merge = !!coalesceKey && lastCoalesce.current?.key === coalesceKey && now - lastCoalesce.current.at < 1000;
        lastCoalesce.current = coalesceKey ? { key: coalesceKey, at: now } : null;
        setState((s) => {
            const value = typeof next === 'function' ? (next as (current: T) => T)(s.present) : next;
            if (value === s.present) return s;
            if (merge) return { ...s, present: value, future: [] };
            return { past: [...s.past, s.present].slice(-LIMIT), present: value, future: [] };
        });
    }, []);

    /** Troca tudo sem histórico (carregar do servidor, aplicar o que foi salvo). */
    const reset = useCallback((value: T) => setState({ past: [], present: value, future: [] }), []);

    const begin = useCallback(() => {
        gestureStart.current = presentRef.current;
    }, []);

    const preview = useCallback((next: T | ((current: T) => T)) => {
        setState((s) => ({ ...s, present: typeof next === 'function' ? (next as (current: T) => T)(s.present) : next }));
    }, []);

    const end = useCallback(() => {
        const start = gestureStart.current;
        gestureStart.current = null;
        if (start === null) return;
        setState((s) => (start === s.present ? s : { past: [...s.past, start].slice(-LIMIT), present: s.present, future: [] }));
    }, []);

    const undo = useCallback(() => {
        setState((s) => (s.past.length ? { past: s.past.slice(0, -1), present: s.past[s.past.length - 1], future: [s.present, ...s.future] } : s));
    }, []);

    const redo = useCallback(() => {
        setState((s) => (s.future.length ? { past: [...s.past, s.present], present: s.future[0], future: s.future.slice(1) } : s));
    }, []);

    return {
        value: state.present,
        set,
        reset,
        begin,
        preview,
        end,
        undo,
        redo,
        canUndo: state.past.length > 0,
        canRedo: state.future.length > 0,
    };
}
