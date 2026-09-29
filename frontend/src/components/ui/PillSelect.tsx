// frontend/src/components/ui/PillSelect.tsx
//
// Seletor com aparência de etiqueta de status: UM controle no lugar de "etiqueta + seletor" (que
// mostravam a mesma informação duas vezes). A cor acompanha o valor escolhido.

import styled from 'styled-components';

export type PillTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

const TONES: Record<PillTone, { bg: string; fg: string }> = {
    neutral: { bg: '#e9ecef', fg: '#6c757d' },
    success: { bg: '#e6f7ec', fg: '#28a745' },
    warning: { bg: '#fff8e1', fg: '#b8860b' },
    danger: { bg: '#fdecea', fg: '#e03131' },
    info: { bg: '#e0f2fe', fg: '#0369a1' },
};

const chevron = (color: string) =>
    `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='${encodeURIComponent(color)}' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'><path d='m6 9 6 6 6-6'/></svg>")`;

export const PillSelect = styled.select<{ $tone: PillTone }>`
    appearance: none;
    -webkit-appearance: none;
    padding: 0.3rem 1.55rem 0.3rem 0.7rem;
    border: none;
    border-radius: 999px;
    font-family: inherit;
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.02em;
    cursor: pointer;
    background-color: ${({ $tone }) => TONES[$tone].bg};
    color: ${({ $tone }) => TONES[$tone].fg};
    background-image: ${({ $tone }) => chevron(TONES[$tone].fg)};
    background-repeat: no-repeat;
    background-position: right 0.55rem center;

    &:focus-visible {
        outline: 2px solid ${({ theme }) => theme.colors.primary};
        outline-offset: 2px;
    }

    &:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }

    option {
        text-transform: none;
        color: #212529;
        background: #fff;
    }
`;
