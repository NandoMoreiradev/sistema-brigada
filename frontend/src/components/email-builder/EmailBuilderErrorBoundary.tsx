// frontend/src/components/email-builder/EmailBuilderErrorBoundary.tsx

import React, { Component } from 'react';
import type { ReactNode } from 'react';
import styled from 'styled-components';
import { Warning, ArrowClockwise } from 'phosphor-react';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

const ErrorContainer = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 400px;
    padding: 2rem;
    background: #f8f9fa;
    border-radius: 12px;
    border: 2px dashed #dc3545;
`;

const ErrorIcon = styled.div`
    width: 80px;
    height: 80px;
    border-radius: 50%;
    background: linear-gradient(135deg, #dc3545 0%, #c82333 100%);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 1.5rem;
    box-shadow: 0 8px 32px rgba(220, 53, 69, 0.3);
`;

const ErrorTitle = styled.h2`
    font-size: 1.5rem;
    color: #343a40;
    margin: 0 0 0.5rem 0;
    font-weight: 700;
`;

const ErrorMessage = styled.p`
    font-size: 1rem;
    color: #6c757d;
    margin: 0 0 1.5rem 0;
    text-align: center;
    max-width: 500px;
`;

const ErrorDetails = styled.details`
    background: white;
    border: 1px solid #dee2e6;
    border-radius: 8px;
    padding: 1rem;
    margin-bottom: 1.5rem;
    max-width: 600px;
    width: 100%;
    
    summary {
        cursor: pointer;
        font-weight: 600;
        color: #495057;
        user-select: none;
        
        &:hover {
            color: #212529;
        }
    }
    
    pre {
        margin-top: 1rem;
        padding: 1rem;
        background: #f8f9fa;
        border-radius: 6px;
        overflow-x: auto;
        font-size: 0.875rem;
        color: #dc3545;
    }
`;

const RetryButton = styled.button`
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 12px 24px;
    background: linear-gradient(135deg, #007bff 0%, #0056b3 100%);
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
    
    &:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 20px rgba(0, 123, 255, 0.3);
    }
`;

export class EmailBuilderErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        // ✅ LOG ESTRUTURADO: Enviar para serviço de monitoramento (Sentry, LogRocket)
        console.error('EmailBuilder Error:', {
            error: error.message,
            stack: error.stack,
            componentStack: errorInfo.componentStack,
            timestamp: new Date().toISOString()
        });

        // TODO: Integrar com Sentry
        // Sentry.captureException(error, { contexts: { react: { componentStack: errorInfo.componentStack } } });
    }

    handleReset = () => {
        this.setState({ hasError: false, error: null });
    };

    render() {
        if (this.state.hasError) {
            return (
                <ErrorContainer>
                    <ErrorIcon>
                        <Warning size={40} weight="bold" />
                    </ErrorIcon>
                    <ErrorTitle>Ops! Algo deu errado no Editor</ErrorTitle>
                    <ErrorMessage>
                        O editor de e-mail encontrou um problema inesperado.
                        Tente recarregar a página ou entre em contato com o suporte se o problema persistir.
                    </ErrorMessage>

                    {this.state.error && (
                        <ErrorDetails>
                            <summary>Detalhes Técnicos</summary>
                            <pre>{this.state.error.message}</pre>
                        </ErrorDetails>
                    )}

                    <RetryButton onClick={this.handleReset}>
                        <ArrowClockwise size={20} weight="bold" />
                        Tentar Novamente
                    </RetryButton>
                </ErrorContainer>
            );
        }

        return this.props.children;
    }
}