// frontend/src/components/common/PlaceholderPage.tsx
// Casca mínima para páginas ainda não implementadas: só título + mensagem,
// o suficiente para a rota renderizar algo enquanto a feature real não existe.

import type { ReactNode } from 'react';
import styled from 'styled-components';
import { PageLayout } from '@/components/layout/PageLayout';

const EmptyState = styled.div`
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    background: ${({ theme }) => theme.colors.white};
    border-radius: ${({ theme }) => theme.radii.md};
    border: 1px dashed ${({ theme }) => theme.colors.border};
    color: ${({ theme }) => theme.colors.textMuted};
    font-size: 0.9375rem;
    min-height: 240px;
`;

interface PlaceholderPageProps {
    title: string;
    subtitle?: string;
    icon?: ReactNode;
    message?: string;
}

export function PlaceholderPage({ title, subtitle, icon, message }: PlaceholderPageProps) {
    return (
        <PageLayout title={title} subtitle={subtitle} icon={icon}>
            <EmptyState>{message || 'Em construção.'}</EmptyState>
        </PageLayout>
    );
}
