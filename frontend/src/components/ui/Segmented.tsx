// frontend/src/components/ui/Segmented.tsx
//
// Controle segmentado: troca entre visões da MESMA tela (Lista | Cobertura). Visualmente diferente
// dos chips de filtro, para o usuário não confundir "trocar de visão" com "filtrar".

import type { ReactNode } from 'react';
import styled from 'styled-components';

const Group = styled.div`
    display: inline-flex;
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.radii.sm};
    background: ${({ theme }) => theme.colors.white};
    overflow: hidden;
`;

const Option = styled.button<{ $active: boolean }>`
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.5rem 0.9rem;
    border: none;
    background: ${({ theme, $active }) => ($active ? theme.colors.primaryLight : 'transparent')};
    color: ${({ theme, $active }) => ($active ? theme.colors.primary : theme.colors.textMedium)};
    font-size: 0.8125rem;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;

    & + & {
        border-left: 1px solid ${({ theme }) => theme.colors.border};
    }

    &:hover {
        background: ${({ theme, $active }) => ($active ? theme.colors.primaryLight : theme.colors.lightGray)};
    }
`;

interface SegmentedProps<T extends string> {
    value: T;
    onChange: (value: T) => void;
    options: { value: T; label: string; icon?: ReactNode }[];
    ariaLabel: string;
}

export function Segmented<T extends string>({ value, onChange, options, ariaLabel }: SegmentedProps<T>) {
    return (
        <Group role="radiogroup" aria-label={ariaLabel}>
            {options.map((option) => (
                <Option key={option.value} type="button" role="radio" aria-checked={value === option.value} $active={value === option.value} onClick={() => onChange(option.value)}>
                    {option.icon}
                    {option.label}
                </Option>
            ))}
        </Group>
    );
}
