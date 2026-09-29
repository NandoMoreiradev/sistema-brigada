// Cores por situação de cobertura de um posto (pino, cartão, legenda).
import type { CoverageState } from '@/utils/schedule';

export const STATE_COLOR: Record<CoverageState, string> = {
    empty: '#d9480f',
    partial: '#f08c00',
    full: '#2b8a3e',
    over: '#7048e8',
    open: '#1c7ed6',
};
