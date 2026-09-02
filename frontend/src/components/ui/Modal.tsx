// frontend/src/components/ui/Modal.tsx
//
// Wrapper fino sobre @radix-ui/react-dialog (já era dependência do projeto,
// só não estava sendo usado ainda) — acessibilidade (foco, Esc, overlay)
// vem de graça do Radix, só estilizamos.

import type { ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import styled, { keyframes } from 'styled-components';
import { X } from 'lucide-react';

const fadeIn = keyframes`
    from { opacity: 0; }
    to { opacity: 1; }
`;

const slideIn = keyframes`
    from { opacity: 0; transform: translate(-50%, -48%) scale(0.98); }
    to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
`;

const Overlay = styled(Dialog.Overlay)`
    position: fixed;
    inset: 0;
    background: rgba(20, 23, 28, 0.45);
    animation: ${fadeIn} 0.15s ease-out;
    z-index: 100;
`;

const Content = styled(Dialog.Content)<{ $width?: string }>`
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: ${({ $width }) => $width || '480px'};
    max-width: calc(100vw - 2rem);
    max-height: calc(100vh - 4rem);
    overflow-y: auto;
    background: ${({ theme }) => theme.colors.white};
    border-radius: ${({ theme }) => theme.radii.md};
    box-shadow: ${({ theme }) => theme.shadows.e3};
    padding: 1.25rem 1.5rem 1.5rem;
    animation: ${slideIn} 0.15s ease-out;
    z-index: 101;
`;

const Header = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1rem;
`;

const Title = styled(Dialog.Title)`
    font-size: 1rem;
    font-weight: 700;
    color: ${({ theme }) => theme.colors.textDark};
    margin: 0;
`;

const CloseButton = styled.button`
    background: transparent;
    border: none;
    cursor: pointer;
    color: ${({ theme }) => theme.colors.textMuted};
    display: flex;
    padding: 0.25rem;
    border-radius: ${({ theme }) => theme.radii.sm};

    &:hover {
        background: ${({ theme }) => theme.colors.lightGray};
    }
`;

interface ModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    width?: string;
    children: ReactNode;
}

export function Modal({ open, onOpenChange, title, width, children }: ModalProps) {
    return (
        <Dialog.Root open={open} onOpenChange={onOpenChange}>
            <Dialog.Portal>
                <Overlay />
                <Content $width={width}>
                    <Header>
                        <Title>{title}</Title>
                        <Dialog.Close asChild>
                            <CloseButton aria-label="Fechar">
                                <X size={18} />
                            </CloseButton>
                        </Dialog.Close>
                    </Header>
                    {children}
                </Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}
