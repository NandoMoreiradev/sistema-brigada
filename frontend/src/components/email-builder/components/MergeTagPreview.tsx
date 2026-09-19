/**
 * Componente de Preview de Merge Tags
 * Mostra como o texto ficará com os dados processados
 */

import React, { useState, useMemo } from 'react';
import styled from 'styled-components';
import { processMergeTags, DEFAULT_TEST_DATA } from '../utils/mergeTagProcessor';
import type { MergeTagContext } from '../utils/mergeTagProcessor';
import { validateMergeTags } from '../utils/mergeTagValidator';

// ===== STYLED COMPONENTS =====

const PreviewContainer = styled.div`
    margin-top: 12px;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    overflow: hidden;
    background: white;
`;

const PreviewHeader = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 12px;
    background: #f8f9fa;
    border-bottom: 1px solid #e0e0e0;
`;

const PreviewTitle = styled.div`
    font-size: 12px;
    font-weight: 600;
    color: #666;
    display: flex;
    align-items: center;
    gap: 6px;
`;

const PreviewToggle = styled.button`
    padding: 4px 8px;
    font-size: 11px;
    background: white;
    border: 1px solid #ddd;
    border-radius: 4px;
    cursor: pointer;
    color: #666;
    transition: all 0.2s;

    &:hover {
        background: #f0f0f0;
        border-color: #bbb;
    }
`;

const PreviewContent = styled.div`
    padding: 12px;
    min-height: 60px;
    max-height: 200px;
    overflow-y: auto;
    font-size: 14px;
    line-height: 1.6;
    color: #333;
    white-space: pre-wrap;
    word-break: break-word;
    background: #fafbfc;
`;

const ValidationErrors = styled.div`
    padding: 10px 12px;
    background: #fef2f2;
    border-top: 1px solid #fecaca;
`;

const ValidationError = styled.div<{ type: 'error' | 'warning' }>`
    font-size: 12px;
    color: ${(props) => (props.type === 'error' ? '#dc2626' : '#f59e0b')};
    margin-bottom: 6px;
    display: flex;
    align-items: flex-start;
    gap: 6px;

    &:last-child {
        margin-bottom: 0;
    }
`;

const ErrorIcon = styled.span`
    flex-shrink: 0;
    margin-top: 2px;
`;

const EmptyState = styled.div`
    color: #999;
    font-size: 13px;
    font-style: italic;
    padding: 12px;
    text-align: center;
`;

const Badge = styled.span<{ $variant: 'success' | 'error' | 'warning' }>`
    padding: 2px 8px;
    font-size: 11px;
    font-weight: 600;
    border-radius: 12px;
    background: ${(props) =>
        props.$variant === 'success'
            ? '#dcfce7'
            : props.$variant === 'error'
            ? '#fecaca'
            : '#fef3c7'};
    color: ${(props) =>
        props.$variant === 'success'
            ? '#16a34a'
            : props.$variant === 'error'
            ? '#dc2626'
            : '#f59e0b'};
`;

// ===== INTERFACES =====

interface MergeTagPreviewProps {
    text: string;
    testData?: MergeTagContext;
    showValidation?: boolean;
}

// ===== COMPONENTE =====

export const MergeTagPreview: React.FC<MergeTagPreviewProps> = ({
    text,
    testData = DEFAULT_TEST_DATA,
    showValidation = true,
}) => {
    const [isExpanded, setIsExpanded] = useState(true);

    // Processar texto
    const processedText = useMemo(() => {
        if (!text) return '';
        try {
            return processMergeTags(text, testData);
        } catch (error) {
            console.error('Erro ao processar preview:', error);
            return text;
        }
    }, [text, testData]);

    // Validar texto
    const validation = useMemo(() => {
        if (!text || !showValidation) return { isValid: true, errors: [] };
        return validateMergeTags(text);
    }, [text, showValidation]);

    const hasErrors = validation.errors.filter((e) => e.type === 'error').length > 0;
    const hasWarnings = validation.errors.filter((e) => e.type === 'warning').length > 0;

    if (!text) {
        return (
            <PreviewContainer>
                <PreviewHeader>
                    <PreviewTitle>
                        👁️ Preview
                        <Badge $variant="success">OK</Badge>
                    </PreviewTitle>
                </PreviewHeader>
                <EmptyState>Digite algo para ver o preview...</EmptyState>
            </PreviewContainer>
        );
    }

    return (
        <PreviewContainer>
            <PreviewHeader>
                <PreviewTitle>
                    👁️ Preview
                    {hasErrors && <Badge $variant="error">❌ Erros</Badge>}
                    {!hasErrors && hasWarnings && <Badge $variant="warning">⚠️ Avisos</Badge>}
                    {!hasErrors && !hasWarnings && <Badge $variant="success">✓ OK</Badge>}
                </PreviewTitle>
                <PreviewToggle onClick={() => setIsExpanded(!isExpanded)}>
                    {isExpanded ? '▼ Recolher' : '▶ Expandir'}
                </PreviewToggle>
            </PreviewHeader>

            {isExpanded && (
                <>
                    {showValidation && validation.errors.length > 0 && (
                        <ValidationErrors>
                            {validation.errors.map((error, index) => (
                                <ValidationError key={index} type={error.type}>
                                    <ErrorIcon>
                                        {error.type === 'error' ? '❌' : '⚠️'}
                                    </ErrorIcon>
                                    <span>{error.message}</span>
                                </ValidationError>
                            ))}
                        </ValidationErrors>
                    )}

                    <PreviewContent>
                        {processedText || (
                            <EmptyState>Nenhum conteúdo processado</EmptyState>
                        )}
                    </PreviewContent>
                </>
            )}
        </PreviewContainer>
    );
};