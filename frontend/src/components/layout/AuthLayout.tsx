// frontend/src/components/layout/AuthLayout.tsx
// Versão simplificada do AuthLayout do maskotCrmEdu — sem logo em imagem
// (ainda não temos asset de marca neste projeto), texto no lugar.

import type { ReactNode } from 'react';
import styled, { keyframes } from 'styled-components';
import { Flame } from 'lucide-react';

interface AuthLayoutProps {
    children: ReactNode;
    title: string;
    subtitle?: string;
    footer?: ReactNode;
}

const fadeIn = keyframes`
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
`;

const AuthLayoutContainer = styled.div`
    display: flex;
    flex-direction: column;
    min-height: 100vh;
    min-height: 100dvh;
    position: relative;
    background: linear-gradient(135deg, #b02a1f 0%, #d9480f 50%, #e8590c 100%);

    &::before {
        content: '';
        position: absolute;
        inset: 0;
        background: radial-gradient(circle at 30% 20%, rgba(255, 255, 255, 0.05) 0%, transparent 50%);
        pointer-events: none;
    }
`;

const AuthMain = styled.div`
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    position: relative;
    z-index: 1;
    min-height: 0;
`;

const PageFooterSlot = styled.footer`
    position: relative;
    z-index: 1;
    flex-shrink: 0;
    width: 100%;
    text-align: center;
    padding: 0.5rem 1rem calc(1rem + env(safe-area-inset-bottom, 0px));
    color: rgba(255, 255, 255, 0.8);
    font-size: 0.75rem;
`;

const AuthCard = styled.div`
    width: 100%;
    max-width: 420px;
    padding: 2.5rem;
    background: rgba(255, 255, 255, 0.12);
    border-radius: 20px;
    border: 1px solid rgba(255, 255, 255, 0.18);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
    text-align: center;
    animation: ${fadeIn} 0.5s ease-out;
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);

    @media (max-width: 500px) {
        max-width: 90%;
        margin: 1rem;
        padding: 2rem;
    }
`;

const LogoBadge = styled.div`
    width: 64px;
    height: 64px;
    margin: 0 auto 1.5rem;
    border-radius: 16px;
    background: rgba(255, 255, 255, 0.16);
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
`;

const Title = styled.h1`
    font-size: 1.8rem;
    font-weight: 700;
    color: white;
    margin-bottom: 0.5rem;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
`;

const Subtitle = styled.p`
    font-size: 1rem;
    color: rgba(255, 255, 255, 0.9);
    margin-bottom: 2rem;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
`;

export function AuthLayout({ children, title, subtitle, footer }: AuthLayoutProps) {
    return (
        <AuthLayoutContainer>
            <AuthMain>
                <AuthCard>
                    <LogoBadge>
                        <Flame size={32} />
                    </LogoBadge>
                    <Title>{title}</Title>
                    {subtitle && <Subtitle>{subtitle}</Subtitle>}
                    {children}
                </AuthCard>
            </AuthMain>
            {footer ? <PageFooterSlot>{footer}</PageFooterSlot> : null}
        </AuthLayoutContainer>
    );
}
