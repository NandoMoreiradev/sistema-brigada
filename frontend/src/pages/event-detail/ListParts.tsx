// frontend/src/pages/event-detail/ListParts.tsx
//
// Peças visuais compartilhadas pelas abas Ocorrências e Arquivos: barra de ferramentas numa linha
// só e lista compacta (uma linha por item, ações atrás de um "⋯"), no lugar de tabelas largas.

import styled from 'styled-components';

export const TabBar = styled.div`
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.5rem 1rem;
    margin-bottom: 0.6rem;
`;

export const BarGroup = styled.div`
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.4rem;
`;

export const CompactList = styled.ul`
    list-style: none;
    margin: 0;
    padding: 0;
    background: ${({ theme }) => theme.colors.white};
    border: 1px solid ${({ theme }) => theme.colors.borderLight};
    border-radius: ${({ theme }) => theme.radii.md};
    overflow: hidden;
`;

export const CompactRow = styled.li`
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.55rem 0.8rem;
    min-width: 0;

    & + & {
        border-top: 1px solid ${({ theme }) => theme.colors.borderLight};
    }

    &:hover {
        background: ${({ theme }) => theme.colors.lightGray};
    }
`;

export const RowMain = styled.div`
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.1rem;

    .title {
        font-size: 0.875rem;
        font-weight: 600;
        color: ${({ theme }) => theme.colors.textDark};
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .desc {
        font-size: 0.8125rem;
        color: ${({ theme }) => theme.colors.textMedium};
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
    }

    .meta {
        font-size: 0.75rem;
        color: ${({ theme }) => theme.colors.textMuted};
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
`;

/** Botão de texto pequeno (Ouvir / Visualizar / Abrir) alinhado com o restante da linha. */
export const InlineAction = styled.button`
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.2rem 0.5rem;
    border: none;
    border-radius: ${({ theme }) => theme.radii.sm};
    background: transparent;
    color: ${({ theme }) => theme.colors.primary};
    font: inherit;
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
    text-decoration: none;
    white-space: nowrap;

    &:hover {
        background: ${({ theme }) => theme.colors.primaryLight};
    }
`;

export const TypeIcon = styled.span`
    flex: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 2rem;
    border-radius: ${({ theme }) => theme.radii.sm};
    background: ${({ theme }) => theme.colors.primaryLight};
    color: ${({ theme }) => theme.colors.primary};
`;
