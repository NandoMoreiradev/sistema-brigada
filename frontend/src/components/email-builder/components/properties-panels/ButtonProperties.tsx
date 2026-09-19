import React, { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import { useDebouncedCallback } from 'use-debounce';

import type { ExtendedBlockProps } from '../../types';
import { Label } from '../../styles';
import { MergeTagPicker } from '../MergeTagPicker';

// =============================================================================
// STYLED COMPONENTS
// =============================================================================

const InputWrapper = styled.div`
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
`;

const StyledInput = styled.input`
    width: 100%;
    padding: 8px 12px;
    border-radius: 4px;
    border: 1px solid #ccc;
    font-size: 14px;
    flex-grow: 1;
    
    &:focus {
        outline: none;
        border-color: #2563eb;
        box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
    }
`;

const ValidationMessage = styled.div<{ type: 'error' | 'warning' | 'info' }>`
    font-size: 12px;
    margin-top: 4px;
    padding: 6px 8px;
    border-radius: 4px;
    
    ${({ type }) => {
    switch (type) {
        case 'error':
            return `
                    color: #dc3545;
                    background-color: #f8d7da;
                    border: 1px solid #f5c6cb;
                `;
        case 'warning':
            return `
                    color: #856404;
                    background-color: #fff3cd;
                    border: 1px solid #ffeaa7;
                `;
        case 'info':
            return `
                    color: #004085;
                    background-color: #cce5ff;
                    border: 1px solid #b8daff;
                `;
    }
}}
`;

// =============================================================================
// VALIDAÇÃO DE URL
// =============================================================================

interface URLValidation {
    isValid: boolean;
    message?: string;
    type?: 'error' | 'warning' | 'info';
}

function validateURL(url: string): URLValidation {
    if (!url || url.trim() === '') {
        return { isValid: true };
    }

    // Permite merge tags
    if (url.includes('{{') && url.includes('}}')) {
        return {
            isValid: true,
            message: 'Merge tag detectada - será substituída no envio',
            type: 'info'
        };
    }

    // Bloqueia protocolos perigosos
    const dangerousProtocols = /^(javascript|data|vbscript|file):/i;
    if (dangerousProtocols.test(url)) {
        return {
            isValid: false,
            message: 'URL inválida: protocolo não permitido (use http://, https://, mailto:, tel:)',
            type: 'error'
        };
    }

    // Valida protocolos permitidos
    const validProtocols = /^(https?|mailto|tel):/i;
    const isRelative = url.startsWith('/') || url.startsWith('#');

    if (!validProtocols.test(url) && !isRelative) {
        return {
            isValid: false,
            message: 'URL deve começar com http://, https://, mailto:, tel:, / ou #',
            type: 'error'
        };
    }

    // Aviso para URLs sem HTTPS
    if (url.startsWith('http://') && !url.includes('localhost')) {
        return {
            isValid: true,
            message: 'Recomendado: use HTTPS para maior segurança',
            type: 'warning'
        };
    }

    return { isValid: true };
}

// =============================================================================
// INTERFACES
// =============================================================================

interface ButtonPropertiesProps {
    props: ExtendedBlockProps;
    onPropsChange: (newProps: ExtendedBlockProps) => void;
}

// =============================================================================
// COMPONENTE
// =============================================================================

export const ButtonProperties: React.FC<ButtonPropertiesProps> = ({ props, onPropsChange }) => {
    const [localChildren, setLocalChildren] = useState(props.children || '');
    const [localHref, setLocalHref] = useState(props.href || '');
    const [urlValidation, setUrlValidation] = useState<URLValidation>({ isValid: true });

    // Sincronizar estado local quando props mudam externamente
    useEffect(() => {
        setLocalChildren(props.children || '');
        setLocalHref(props.href || '');
    }, [props.children, props.href]);

    // Debounced update para o texto do botão (300ms)
    const debouncedChildrenUpdate = useDebouncedCallback(
        (value: string) => {
            onPropsChange({ ...props, children: value });
        },
        300
    );

    // Debounced update para a URL (500ms - mais longo pois valida)
    const debouncedHrefUpdate = useDebouncedCallback(
        (value: string) => {
            const validation = validateURL(value);
            setUrlValidation(validation);

            if (validation.isValid) {
                onPropsChange({ ...props, href: value });
            }
        },
        500
    );

    const handleChildrenChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.value;
        setLocalChildren(newValue);
        debouncedChildrenUpdate(newValue);
    }, [debouncedChildrenUpdate]);

    const handleHrefChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.value;
        setLocalHref(newValue);
        debouncedHrefUpdate(newValue);
    }, [debouncedHrefUpdate]);

    const handleTagSelect = useCallback((tag: string, fieldName: keyof ExtendedBlockProps) => {
        if (fieldName === 'children') {
            const newValue = `${localChildren}{{${tag}}}`;
            setLocalChildren(newValue);
            onPropsChange({ ...props, children: newValue });
        } else if (fieldName === 'href') {
            const newValue = `${localHref}{{${tag}}}`;
            setLocalHref(newValue);
            onPropsChange({ ...props, href: newValue });
        }
    }, [localChildren, localHref, props, onPropsChange]);

    return (
        <>
            <div style={{ marginBottom: '1rem' }}>
                <Label>Texto do Botão</Label>
                <InputWrapper>
                    <StyledInput
                        type="text"
                        name="children"
                        value={localChildren}
                        onChange={handleChildrenChange}
                        placeholder="Ex: Clique aqui"
                        aria-label="Texto do botão"
                    />
                    <MergeTagPicker onSelect={(tag) => handleTagSelect(tag, 'children')}>
                        <button
                            type="button"
                            style={{
                                padding: '6px 8px',
                                background: 'white',
                                border: '1px solid #ddd',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '16px',
                            }}
                            aria-label="Inserir merge tag no texto do botão"
                        >
                            🏷️
                        </button>
                    </MergeTagPicker>
                </InputWrapper>
            </div>

            <div style={{ marginBottom: '1rem' }}>
                <Label>URL do Link</Label>
                <InputWrapper>
                    <StyledInput
                        type="url"
                        name="href"
                        value={localHref}
                        onChange={handleHrefChange}
                        placeholder="https://exemplo.com"
                        aria-label="URL do link do botão"
                        aria-invalid={!urlValidation.isValid}
                        aria-describedby={urlValidation.message ? 'url-validation-message' : undefined}
                    />
                    <MergeTagPicker onSelect={(tag) => handleTagSelect(tag, 'href')}>
                        <button
                            type="button"
                            style={{
                                padding: '6px 8px',
                                background: 'white',
                                border: '1px solid #ddd',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '16px',
                            }}
                            aria-label="Inserir merge tag na URL do botão"
                        >
                            🏷️
                        </button>
                    </MergeTagPicker>
                </InputWrapper>
                {urlValidation.message && (
                    <ValidationMessage
                        type={urlValidation.type!}
                        id="url-validation-message"
                        role="alert"
                    >
                        {urlValidation.message}
                    </ValidationMessage>
                )}
            </div>
        </>
    );
};