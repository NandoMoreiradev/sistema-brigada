import styled from 'styled-components';

export const TableWrapper = styled.div`
    background: ${({ theme }) => theme.colors.white};
    border-radius: ${({ theme }) => theme.radii.md};
    border: 1px solid ${({ theme }) => theme.colors.borderLight};
    overflow: hidden;
`;

export const Table = styled.table`
    width: 100%;
    border-collapse: collapse;
    font-size: 0.8125rem;
`;

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
