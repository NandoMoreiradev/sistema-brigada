// frontend/src/pages/course-detail/styles.ts
//
// Estilos compartilhados pelas abas da tela de turma (CourseDetail).

import styled from 'styled-components';

/** Tabelas largas rolam na horizontal em vez de estourar o layout no celular/tablet. */
export const ScrollX = styled.div`
    overflow-x: auto;
`;

export const Toolbar = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    flex-wrap: wrap;
    margin-bottom: 0.75rem;
`;

export const ToolbarGroup = styled.div`
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
`;

export const SearchInput = styled.input`
    padding: 0.5rem 0.75rem;
    min-width: 220px;
    border-radius: ${({ theme }) => theme.radii.sm};
    border: 1px solid ${({ theme }) => theme.colors.border};
    font-size: 0.8125rem;
    font-family: inherit;

    &:focus {
        outline: none;
        border-color: ${({ theme }) => theme.colors.primary};
        box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.15);
    }
`;

export const FilterChip = styled.button<{ $active?: boolean }>`
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.3rem 0.7rem;
    border-radius: ${({ theme }) => theme.radii.pill};
    border: 1px solid ${({ theme, $active }) => ($active ? theme.colors.primary : theme.colors.border)};
    background: ${({ theme, $active }) => ($active ? theme.colors.primaryLight : theme.colors.white)};
    color: ${({ theme, $active }) => ($active ? theme.colors.primary : theme.colors.textMedium)};
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;

    &:hover {
        border-color: ${({ theme }) => theme.colors.primary};
    }
`;

export const RowActions = styled.div`
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.25rem;
`;

export const Muted = styled.span`
    color: ${({ theme }) => theme.colors.textMuted};
    font-size: 0.75rem;
`;

export const MiniProgress = styled.div<{ $percent: number }>`
    height: 6px;
    width: 72px;
    border-radius: 999px;
    background: ${({ theme }) => theme.colors.backgroundMedium};
    overflow: hidden;

    &::after {
        content: '';
        display: block;
        height: 100%;
        width: ${({ $percent }) => Math.min(100, Math.max(0, $percent))}%;
        background: ${({ theme }) => theme.colors.success};
    }
`;
