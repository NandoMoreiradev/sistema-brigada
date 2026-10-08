import { useLayoutEffect, useRef, type ComponentPropsWithoutRef } from 'react';
import styled, { css } from 'styled-components';

/** Abaixo disso a tabela vira uma lista de cartões (uma linha = um cartão). */
const STACK_BREAKPOINT = 640;

export const TableWrapper = styled.div`
    background: ${({ theme }) => theme.colors.white};
    border-radius: ${({ theme }) => theme.radii.md};
    border: 1px solid ${({ theme }) => theme.colors.borderLight};
    overflow: hidden;
    /* Dentro do PageLayout (flex em coluna com min-height: 0), o overflow
       hidden zera o min-height automático e o wrapper encolhia até caber na
       tela, cortando as linhas em vez de rolar a página. */
    flex-shrink: 0;

    /* Com a tabela em cartões, o contorno do wrapper só atrapalha: os cartões têm o próprio. */
    @media (max-width: ${STACK_BREAKPOINT}px) {
        &:has(table[data-stack='true']) {
            background: transparent;
            border: none;
            border-radius: 0;
            overflow: visible;
        }
    }
`;

// Cada linha vira um cartão: a 1ª célula é o título e as demais mostram o nome da coluna
// (data-label, preenchido por `Table` a partir do cabeçalho) acima do valor. Célula de coluna
// sem título (as ações) vai para o rodapé do cartão, alinhada à direita.
const stackedStyles = css`
    display: block;

    thead {
        display: none;
    }

    tbody {
        display: flex;
        flex-direction: column;
        gap: 0.6rem;
    }

    tr {
        display: block;
        padding: 0.35rem 0.9rem;
        border: 1px solid ${({ theme }) => theme.colors.borderLight};
        border-radius: ${({ theme }) => theme.radii.md};
        background: ${({ theme }) => theme.colors.white};
        box-shadow: ${({ theme }) => theme.shadows.e1};
    }

    td {
        display: block;
        padding: 0.45rem 0;
        border-top: 1px dashed ${({ theme }) => theme.colors.borderLight};
        overflow-wrap: anywhere;
    }

    td:first-child {
        border-top: none;
        padding-top: 0.6rem;
        font-size: 0.9375rem;
        font-weight: 700;
    }

    td[data-label]::before {
        content: attr(data-label);
        display: block;
        margin-bottom: 0.15rem;
        font-size: 0.6875rem;
        font-weight: 700;
        letter-spacing: 0.03em;
        text-transform: uppercase;
        color: ${({ theme }) => theme.colors.textMuted};
    }

    td[data-actions] {
        display: flex;
        flex-wrap: wrap;
        justify-content: flex-end;
        gap: 0.25rem;
    }
`;

const StyledTable = styled.table<{ $stack: boolean }>`
    width: 100%;
    border-collapse: collapse;
    font-size: 0.8125rem;

    @media (max-width: ${STACK_BREAKPOINT}px) {
        ${({ $stack }) => $stack && stackedStyles}
    }
`;

/** Copia o texto de cada cabeçalho para as células da coluna (data-label), que o CSS usa nos cartões. */
function labelCells(table: HTMLTableElement) {
    const headRow = table.tHead?.rows[table.tHead.rows.length - 1];
    if (!headRow) return;
    const labels: string[] = [];
    for (const cell of Array.from(headRow.cells)) {
        for (let span = 0; span < cell.colSpan; span += 1) labels.push((cell.textContent ?? '').trim());
    }
    for (const body of Array.from(table.tBodies)) {
        for (const row of Array.from(body.rows)) {
            let column = 0;
            for (const cell of Array.from(row.cells)) {
                const label = column === 0 ? '' : (labels[column] ?? '');
                if (label) cell.setAttribute('data-label', label);
                else cell.removeAttribute('data-label');
                // Coluna sem título (e que não é a 1ª) = botões de ação.
                if (column > 0 && labels[column] === '') cell.setAttribute('data-actions', '');
                else cell.removeAttribute('data-actions');
                column += cell.colSpan;
            }
        }
    }
}

/**
 * Tabela que, no celular, vira uma lista de cartões. Passe `stack={false}` para manter a tabela
 * (com rolagem lateral) quando as colunas só fazem sentido lado a lado.
 */
export function Table({ stack = true, children, ...rest }: ComponentPropsWithoutRef<'table'> & { stack?: boolean }) {
    const ref = useRef<HTMLTableElement>(null);

    useLayoutEffect(() => {
        const table = ref.current;
        if (!table || !stack) return;
        labelCells(table);
        // Linhas entram e saem sem o <Table> re-renderizar (lista que filtra, linha que carrega).
        const observer = new MutationObserver(() => labelCells(table));
        observer.observe(table, { childList: true, subtree: true });
        return () => observer.disconnect();
    }, [stack]);

    return (
        <StyledTable ref={ref} $stack={stack} data-stack={stack} {...rest}>
            {children}
        </StyledTable>
    );
}

export const Thead = styled.thead`
    background: ${({ theme }) => theme.colors.lightGray};
`;

export const Th = styled.th`
    text-align: left;
    padding: 0.65rem 1rem;
    font-weight: 600;
    color: ${({ theme }) => theme.colors.textMedium};
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.02em;
    white-space: nowrap;
`;

export const Td = styled.td`
    padding: 0.65rem 1rem;
    color: ${({ theme }) => theme.colors.textDark};
    border-top: 1px solid ${({ theme }) => theme.colors.borderLight};
    vertical-align: middle;
`;

export const Tr = styled.tr`
    &:hover {
        background: ${({ theme }) => theme.colors.lightGray};
    }
`;

export const EmptyState = styled.div`
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2.5rem 1rem;
    color: ${({ theme }) => theme.colors.textMuted};
    font-size: 0.875rem;
`;

export const Badge = styled.span<{ $tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info' }>`
    display: inline-flex;
    align-items: center;
    padding: 0.15rem 0.55rem;
    border-radius: ${({ theme }) => theme.radii.pill};
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.02em;

    ${({ theme, $tone = 'neutral' }) => {
        const map = {
            neutral: { bg: theme.colors.backgroundMedium, fg: theme.colors.textMedium },
            success: { bg: '#e6f7ec', fg: theme.colors.success },
            warning: { bg: '#fff8e1', fg: '#b8860b' },
            danger: { bg: '#fdecea', fg: theme.colors.danger },
            info: { bg: theme.colors.infoLight, fg: theme.colors.infoDark },
        } as const;
        const { bg, fg } = map[$tone];
        return `background: ${bg}; color: ${fg};`;
    }}
`;
