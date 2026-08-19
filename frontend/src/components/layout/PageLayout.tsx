// frontend/src/components/layout/PageLayout.tsx
// Copiado sem alteração funcional do maskotCrmEdu — é genérico o suficiente
// (título/subtítulo/ações/header) para servir qualquer página deste produto.

import React from 'react';
import styled from 'styled-components';

const PageWrapper = styled.div`
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    /* Sem padding inferior aqui: o Chrome descarta o padding-bottom de um
       container flex com overflow no fim da rolagem, fazendo o conteúdo
       encostar no rodapé. O respiro fica no MainContent (honrado ao rolar). */
    padding: 1rem 1.5rem 0;
    box-sizing: border-box;
    overflow-y: auto;
    animation: fadeIn 0.3s ease-in-out;

    @keyframes fadeIn {
        from {
            opacity: 0;
            transform: translateY(-10px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
`;

const Header = styled.header<{ $sticky?: boolean }>`
    background: ${({ theme }) => theme.colors.white};
    border-radius: 12px;
    padding: 0.5rem 1.25rem;
    border: 1px solid ${({ theme }) => theme.colors.borderLight};
    box-shadow: 0 2px 8px rgba(52, 58, 64, 0.08);
    flex-shrink: 0;

    ${({ $sticky }) => $sticky && `
        position: sticky;
        top: 0;
        z-index: 5;
    `}
`;

const HeaderTop = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
`;

const TitleSection = styled.div`
    display: flex;
    align-items: center;
    gap: 0.625rem;
    min-width: 0;
    flex-shrink: 1;
`;

const TitleIcon = styled.div`
    width: 30px;
    height: 30px;
    border-radius: 7px;
    background: linear-gradient(135deg, #007BFF 0%, #0056b3 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    flex-shrink: 0;
`;

const TitleText = styled.div`
    h1 {
        margin: 0;
        font-size: 0.9375rem;
        font-weight: 700;
        color: ${({ theme }) => theme.colors.textDark};
        line-height: 1.2;
    }

    p {
        margin: 0.1rem 0 0;
        font-size: 0.75rem;
        color: ${({ theme }) => theme.colors.textMedium};
        font-weight: 500;
    }
`;

const HeaderActions = styled.div`
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: nowrap;
    flex-shrink: 0;
`;

const HeaderContent = styled.div`
    margin-top: 0.875rem;
`;

const MainContent = styled.main`
    flex-grow: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: 1rem;
`;

/* Espaçador de rodapé: uma caixa real (flex-shrink: 0) garante o respiro no
   fim de qualquer página, mesmo com overflow/flex aninhado. */
const BottomSpacer = styled.div`
    flex-shrink: 0;
    height: 1rem;
`;

interface PageLayoutProps {
    title: string;
    subtitle?: string;
    icon?: React.ReactNode;
    badge?: React.ReactNode;
    actions?: React.ReactNode;
    headerContent?: React.ReactNode;
    /** Mantém o cabeçalho (título + filtros) fixo no topo ao rolar a página. */
    stickyHeader?: boolean;
    children: React.ReactNode;
}

export const PageLayout: React.FC<PageLayoutProps> = ({
    title, subtitle, icon, badge, actions, headerContent, stickyHeader, children,
}) => {
    return (
        <PageWrapper>
            <Header $sticky={stickyHeader}>
                <HeaderTop>
                    <TitleSection>
                        {icon && <TitleIcon>{icon}</TitleIcon>}
                        <TitleText>
                            <h1>{title}</h1>
                            {subtitle && <p>{subtitle}</p>}
                        </TitleText>
                        {badge}
                    </TitleSection>
                    {actions && <HeaderActions>{actions}</HeaderActions>}
                </HeaderTop>
                {headerContent && <HeaderContent>{headerContent}</HeaderContent>}
            </Header>

            <MainContent>
                {children}
                <BottomSpacer aria-hidden />
            </MainContent>
        </PageWrapper>
    );
};
