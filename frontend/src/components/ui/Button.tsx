// frontend/src/components/ui/Button.tsx
//
// Primeiro componente de UI compartilhado do produto (antes disso cada
// página tinha seu próprio botão estilizado, ex. Login.tsx). Nasce aqui
// porque as telas de gestão (Organizações/Alunos/Turmas) repetem o mesmo
// padrão de ação primária/secundária/perigo — vale a pena reaproveitar antes
// de duplicar pela terceira vez.

import styled, { css } from 'styled-components';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

const variantStyles = {
    primary: css`
        background: ${({ theme }) => theme.colors.primary};
        color: ${({ theme }) => theme.colors.white};
        border: 1px solid transparent;

        &:hover:not(:disabled) {
            background: ${({ theme }) => theme.colors.primaryDark};
        }
    `,
    secondary: css`
        background: ${({ theme }) => theme.colors.white};
        color: ${({ theme }) => theme.colors.textDark};
        border: 1px solid ${({ theme }) => theme.colors.border};

        &:hover:not(:disabled) {
            background: ${({ theme }) => theme.colors.lightGray};
        }
    `,
    danger: css`
        background: ${({ theme }) => theme.colors.white};
        color: ${({ theme }) => theme.colors.danger};
        border: 1px solid ${({ theme }) => theme.colors.danger};

        &:hover:not(:disabled) {
            background: #fff5f5;
        }
    `,
    ghost: css`
        background: transparent;
        color: ${({ theme }) => theme.colors.textMedium};
        border: 1px solid transparent;

        &:hover:not(:disabled) {
            background: ${({ theme }) => theme.colors.lightGray};
        }
    `,
};

export const Button = styled.button<{ $variant?: ButtonVariant }>`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    padding: 0.5rem 0.9rem;
    border-radius: ${({ theme }) => theme.radii.sm};
    font-size: 0.8125rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s ease, opacity 0.15s ease;
    white-space: nowrap;

    ${({ $variant = 'primary' }) => variantStyles[$variant]}

    &:disabled {
        opacity: 0.55;
        cursor: not-allowed;
    }
`;
