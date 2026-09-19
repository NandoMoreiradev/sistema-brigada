// frontend/src/components/email-builder/EditorButton.tsx
//
// Extraído de BaseModal.tsx (Maskot) — só o `Button` estilizado é usado pelo
// EmailBuilder, então portamos apenas ele em vez do kit de modal inteiro
// (que sistema-brigada não tem e não precisa para este editor).

import styled from 'styled-components';
import type { ButtonHTMLAttributes } from 'react';

const colors = {
    primary: '#007BFF',
    primaryDark: '#0056B3',
    textDark: '#18202F',
    textMedium: '#47536B',
    white: '#FFFFFF',
    backgroundLight: '#F7F9FC',
    border: '#E4E9F1',
    borderStrong: '#CFD8E6',
    danger: '#DC3B41',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'danger';
    size?: 'small' | 'medium' | 'large';
}

export const Button = styled.button<ButtonProps>`
    padding: ${({ size = 'medium' }) => {
        if (size === 'small') return '0.5rem 0.875rem';
        if (size === 'large') return '0.875rem 1.5rem';
        return '0.6875rem 1.25rem';
    }};
    border-radius: ${({ size = 'medium' }) => size === 'small' ? '8px' : '10px'};
    font-size: ${({ size = 'medium' }) => {
        if (size === 'small') return '0.85rem';
        if (size === 'large') return '1rem';
        return '0.9rem';
    }};
    font-weight: 600;
    cursor: pointer;
    transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease, box-shadow 0.15s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;

    &:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }

    ${({ variant = 'primary' }) => {
        if (variant === 'primary') return `
            background: ${colors.primary};
            color: ${colors.white};
            border: 1px solid transparent;
            &:hover:not(:disabled) {
                background: ${colors.primaryDark};
            }
        `;
        else if (variant === 'danger') return `
            background: ${colors.danger};
            color: ${colors.white};
            border: 1px solid transparent;
            &:hover:not(:disabled) {
                background: #B8323A;
            }
        `;
        else return `
            background: ${colors.white};
            color: ${colors.textMedium};
            border: 1px solid ${colors.border};
            &:hover:not(:disabled) {
                background: ${colors.backgroundLight};
                border-color: ${colors.borderStrong};
                color: ${colors.textDark};
            }
        `;
    }}
`;
