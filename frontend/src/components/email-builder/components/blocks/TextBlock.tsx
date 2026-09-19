import React, { useMemo, useRef, useEffect } from 'react';
import styled from 'styled-components';
import type { GlobalEmailSettings } from '../../types';

const TextBlockWrapper = styled.div<{ $style?: any; $isEditable?: boolean }>`
    width: 100%;
    word-break: break-word;
    cursor: ${props => props.$isEditable ? 'text' : 'default'};
    outline: ${props => props.$isEditable ? '2px solid #007bff' : 'none'};
    outline-offset: 2px;

    background-color: ${props => props.$style?.backgroundColor || 'transparent'};

    padding: ${props => {
        const p = props.$style?.padding;
        if (!p) return '8px';
        if (typeof p === 'object') {
            return `${p.top || 0}px ${p.right || 0}px ${p.bottom || 0}px ${p.left || 0}px`;
        }
        return `${p}px`;
    }};

    margin: ${props => {
        const m = props.$style?.margin;
        if (!m) return '0';
        if (typeof m === 'object') {
            return `${m.top || 0}px ${m.right || 0}px ${m.bottom || 0}px ${m.left || 0}px`;
        }
        return `${m}px`;
    }};

    border: ${props => {
        const width = props.$style?.borderWidth || 0;
        const color = props.$style?.borderColor || '#e0e0e0';
        return width > 0 ? `${width}px solid ${color}` : 'none';
    }};
    border-radius: ${props => props.$style?.borderRadius || 0}px;

    /* Garante que parágrafos e listas tenham comportamento esperado */
    p { margin: 0 0 1em 0; }
    p:last-child { margin-bottom: 0; }
    ul, ol { margin: 0 0 1em 20px; padding: 0; }
`;

interface TextBlockProps {
    content: string;
    style?: any;
    globalSettings: GlobalEmailSettings;
    isSelected?: boolean;
    onContentChange?: (newContent: string) => void;
}

// Função robusta para decodificar HTML entities
const decodeHtmlEntities = (str: string) => {
    if (!str) return '';
    const txt = document.createElement('textarea');
    txt.innerHTML = str;
    return txt.value;
};

export const TextBlock: React.FC<TextBlockProps> = ({
                                                        content,
                                                        style,
                                                        isSelected = false,
                                                        onContentChange
                                                    }) => {
    const editorRef = useRef<HTMLDivElement>(null);

    // Usamos useMemo para não recalcular a cada render, mas recalcular se o content mudar
    const safeContent = useMemo(() => {
        let processed = content || '<p>Digite seu texto...</p>';

        // Se detectarmos entidades escapadas comuns, forçamos o decode
        // Verificamos &lt; (menor que) ou &gt; (maior que) ou &amp; (e comercial)
        if (processed.includes('&lt;') || processed.includes('&gt;') || processed.includes('&amp;')) {
            processed = decodeHtmlEntities(processed);
        }

        // Camada de segurança extra: se após decodificar ainda tivermos &lt;p&gt; (double escaping), decodifica de novo
        if (processed.includes('&lt;p&gt;') || processed.includes('&lt;div&gt;')) {
            processed = decodeHtmlEntities(processed);
        }

        return processed;
    }, [content]);

    // Atualiza o conteúdo apenas quando NÃO está editando
    useEffect(() => {
        if (!isSelected && editorRef.current && editorRef.current.innerHTML !== safeContent) {
            editorRef.current.innerHTML = safeContent;
        }
    }, [safeContent, isSelected]);

    // Define o conteúdo inicial quando o componente monta
    useEffect(() => {
        if (editorRef.current && !editorRef.current.innerHTML) {
            editorRef.current.innerHTML = safeContent;
        }
    }, []);

    const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
        if (onContentChange) {
            const newContent = e.currentTarget.innerHTML;
            onContentChange(newContent);
        }
    };

    return (
        <TextBlockWrapper
            ref={editorRef}
            $style={style}
            $isEditable={isSelected}
            contentEditable={isSelected}
            suppressContentEditableWarning
            onInput={handleInput}
        />
    );
};