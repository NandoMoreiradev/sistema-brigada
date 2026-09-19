import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Editor } from '@tiptap/react';
import {
    FacebookLogo,
    InstagramLogo,
    TwitterLogo,
    LinkedinLogo,
    YoutubeLogo,
    Link as LinkIconPhosphor,
    TiktokLogo,
    WhatsappLogo,
    TelegramLogo,
    GithubLogo,
    DribbbleLogo,
    BehanceLogo,
    At
} from 'phosphor-react';
import type { ExtendedBlock, GlobalEmailSettings, ExtendedBlockProps, SocialLink } from '../types';
import { BlockContainer } from '../styles';
import styled from 'styled-components';
import { TextBlock } from './blocks/TextBlock';
import DOMPurify from 'dompurify';

// =============================================================================
// CONFIGURAÇÃO DE SANITIZAÇÃO
// =============================================================================

const SANITIZE_CONFIG = {
    ALLOWED_TAGS: [
        'p', 'br', 'strong', 'em', 'u', 'a', 'h1', 'h2', 'h3', 'span', 'mark', 'img', 'div', 'ul', 'ol', 'li', 'blockquote'
    ],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'class', 'style', 'src', 'alt', 'width', 'height', 'align'],
    ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|#|\/)|{{[^}]+}})/i,
};

/**
 * Sanitiza HTML para prevenir XSS
 */
function sanitizeHTML(html: string): string {
    return DOMPurify.sanitize(html, SANITIZE_CONFIG);
}

/**
 * ✅ FIX ROBUSTO: Decodificação Recursiva
 * Desfaz múltiplos níveis de codificação (ex: &amp;lt;p&amp;gt; vira <p>)
 * Isso impede o loop infinito de caracteres estranhos ao editar estilos.
 */
function recursiveDecode(input: string): string {
    if (!input || typeof input !== 'string') return '';

    // Se não estamos no browser, retorna o input (SSR safety)
    if (typeof document === 'undefined') return input;

    const txt = document.createElement('textarea');
    let result = input;
    let previous = '';
    let loopCount = 0;
    const maxLoops = 10;

    // Loop para "descascar" camadas de codificação
    while (result !== previous && loopCount < maxLoops) {
        previous = result;
        txt.innerHTML = result;
        result = txt.value;
        loopCount++;

        // Se não tem mais entidades HTML, paramos
        if (!result.includes('&')) {
            break;
        }
    }

    return result;
}

// =============================================================================
// STYLED COMPONENTS
// =============================================================================

const InlineInput = styled.textarea`
    width: 100%;
    padding: 0;
    margin: 0;
    border: none;
    background-color: transparent;
    resize: none;
    outline: none;
    font-size: inherit;
    font-family: inherit;
    font-weight: inherit;
    color: inherit;
    text-align: inherit;
    line-height: inherit;
`;

// =============================================================================
// INTERFACES
// =============================================================================

interface BlockRendererProps {
    block: ExtendedBlock;
    isSelected: boolean;
    onClick: (e: React.MouseEvent) => void;
    globalSettings: GlobalEmailSettings;
    onUpdateBlock: (blockId: string, newProps: ExtendedBlockProps) => void;
    onEditorReady?: (blockId: string, editor: Editor) => void;
}

// =============================================================================
// NOTA: RichTextWrapper foi removido - agora usamos TextBlock estático
// A edição de texto acontece 100% na sidebar via TextPropertiesSidebar
// =============================================================================

// =============================================================================
// COMPONENTE PRINCIPAL (MEMOIZADO)
// =============================================================================

export const BlockRenderer: React.FC<BlockRendererProps> = React.memo(({
                                                                           block,
                                                                           isSelected,
                                                                           onClick,
                                                                           globalSettings,
                                                                           onUpdateBlock,
                                                                       }) => {
    const blockStyle = block.style || {};
    const [isEditing, setIsEditing] = useState(false);
    const [editText, setEditText] = useState(block.props.children || '');
    const inputRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        setEditText(block.props.children || '');
    }, [block.props.children]);

    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [isEditing]);

    // Memoizar estilos base
    const baseStyle = useMemo<React.CSSProperties>(() => ({
        fontSize: blockStyle.fontSize || '16px',
        fontFamily: blockStyle.fontFamily || globalSettings.fontFamily || 'Arial, sans-serif',
        color: blockStyle.textColor || globalSettings.textColor || '#333333',
        textAlign: (blockStyle.textAlign || 'left') as 'left' | 'center' | 'right' | 'justify',
        margin: '0',
    }), [blockStyle.fontSize, blockStyle.fontFamily, blockStyle.textColor, blockStyle.textAlign, globalSettings.fontFamily, globalSettings.textColor]);

    // Handlers
    const handleDoubleClick = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        if (block.type === 'button') {
            setIsEditing(true);
        }
    }, [block.type]);

    const handleTextChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setEditText(e.target.value);
    }, []);

    const saveChanges = useCallback(() => {
        if (isEditing) {
            const sanitizedText = sanitizeHTML(editText);
            const newProps = { ...block.props, children: sanitizedText };
            onUpdateBlock(block.id, newProps);
            setIsEditing(false);
        }
    }, [isEditing, editText, block.props, block.id, onUpdateBlock]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            saveChanges();
        }
        if (e.key === 'Escape') {
            setIsEditing(false);
            setEditText(block.props.children || '');
        }
    }, [saveChanges, block.props.children]);

    // ✅ REMOVIDO: handleRichTextChange e handleTextEditorReady
    // Não são mais necessários - texto é editado apenas na sidebar

    const renderEditableContent = useCallback((buttonStyle: React.CSSProperties) => {
        if (isEditing) {
            return (
                <InlineInput
                    ref={inputRef}
                    value={editText}
                    onChange={handleTextChange}
                    onBlur={saveChanges}
                    onKeyDown={handleKeyDown}
                    style={buttonStyle}
                    rows={1}
                    aria-label="Editar texto do botão"
                />
            );
        }
        return block.props.children || 'Botão';
    }, [isEditing, editText, handleTextChange, saveChanges, handleKeyDown, block.props.children]);

    // ✅ FIX: Prepara o conteúdo do texto para o Editor
    // Garante que o editor receba HTML real, não texto escapado
    const textContent = useMemo(() => {
        if (block.type !== 'text' && block.type !== 'heading') return '';
        const raw = block.props.children || '';

        // Se já está com entidades escapadas, decodifica
        if (raw.includes('&amp;') || raw.includes('&lt;') || raw.includes('&gt;')) {
            return recursiveDecode(raw);
        }

        return raw;
    }, [block.props.children, block.type]);

    const renderBlock = () => {
        switch (block.type) {
            case 'heading':
            case 'text':
                return (
                    <TextBlock
                        content={textContent}
                        style={blockStyle}
                        globalSettings={globalSettings}
                        isSelected={isSelected}
                        onContentChange={(newContent) => {
                            onUpdateBlock(block.id, { ...block.props, children: newContent });
                        }}
                    />
                );

            case 'button': {
                const buttonStyle: React.CSSProperties = {
                    backgroundColor: blockStyle.backgroundColor || globalSettings.primaryColor || '#007bff',
                    color: blockStyle.textColor || '#ffffff',
                    padding: '12px 24px',
                    borderRadius: blockStyle.borderRadius || '6px',
                    border: blockStyle.borderWidth ? `${blockStyle.borderWidth} solid ${blockStyle.borderColor || '#ccc'}` : 'none',
                    fontWeight: '500',
                    cursor: 'pointer',
                    fontSize: blockStyle.fontSize || '16px',
                    fontFamily: blockStyle.fontFamily || globalSettings.fontFamily || 'Arial, sans-serif',
                };
                return (
                    <div style={{ textAlign: blockStyle.textAlign || 'center' }}>
                        <button
                            style={buttonStyle}
                            onDoubleClick={handleDoubleClick}
                            aria-label={`Botão: ${block.props.children || 'Botão'}. Duplo clique para editar`}
                            role="button"
                        >
                            {isEditing ? renderEditableContent(buttonStyle) : (block.props.children || 'Botão')}
                        </button>
                    </div>
                );
            }

            case 'image':
                // Lógica de largura: Pega do props (novo) ou style (legado), padrão 100%
                const imageWidth = block.props.width || block.style?.width || '100%';

                return (
                    <div style={{ textAlign: blockStyle.textAlign || 'center' }}>
                        <img
                            src={block.props.src || 'https://via.placeholder.com/600x200'}
                            alt={block.props.alt || 'Imagem'}
                            style={{
                                // AQUI: Aplica a largura dinâmica
                                width: imageWidth, 
                                maxWidth: '100%',
                                height: 'auto',
                                border: blockStyle.borderWidth ? `${blockStyle.borderWidth} solid ${blockStyle.borderColor || '#e0e0e0'}` : 'none', // Removida borda padrão fixa para ficar mais limpo
                                borderRadius: blockStyle.borderRadius || '4px'
                            }}
                            loading="lazy"
                        />
                    </div>
                );

            case 'divider':
                return (
                    <hr
                        style={{
                            borderColor: blockStyle.borderColor || '#e0e0e0',
                            borderWidth: blockStyle.borderWidth || '1px',
                            borderStyle: 'solid',
                            margin: '0',
                            backgroundColor: blockStyle.backgroundColor || 'transparent'
                        }}
                        aria-hidden="true"
                    />
                );

            case 'columns': {
                const columns = block.props.columns || [];
                return (
                    <div
                        style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', ...baseStyle }}
                        role="group"
                        aria-label="Colunas de conteúdo"
                    >
                        {columns.map((column) => (
                            <div key={column.id} style={{
                                flex: 1,
                                minWidth: '200px',
                                padding: '12px',
                                border: '1px solid #e9ecef',
                                borderRadius: '4px',
                                backgroundColor: blockStyle.backgroundColor || '#f8f9fa'
                            }}>
                                {/* Também aplicamos decodificação nas colunas */}
                                <div dangerouslySetInnerHTML={{ __html: sanitizeHTML(recursiveDecode(column.content || '')) }} />
                            </div>
                        ))}
                    </div>
                );
            }

            case 'list': {
                const items = block.props.items || [];
                const ListTag = block.props.listType === 'numbered' ? 'ol' : 'ul';
                return (
                    <ListTag
                        style={{ ...baseStyle, paddingLeft: '20px', lineHeight: '1.6' }}
                        aria-label={block.props.listType === 'numbered' ? 'Lista numerada' : 'Lista com marcadores'}
                    >
                        {items.map((item) => (
                            <li key={item.id} style={{ marginBottom: '8px' }}>
                                {item.text}
                            </li>
                        ))}
                    </ListTag>
                );
            }

            case 'table': {
                const headers = block.props.tableHeaders || [];
                const rows = block.props.tableRows || [];
                return (
                    <div style={{ overflowX: 'auto' }}>
                        <table
                            style={{ width: '100%', borderCollapse: 'collapse', ...baseStyle }}
                            role="table"
                            aria-label="Tabela de dados"
                        >
                            <thead>
                            <tr>
                                {headers.map((header, index) => (
                                    <th key={index} style={{
                                        padding: '12px',
                                        border: '1px solid #dee2e6',
                                        backgroundColor: blockStyle.backgroundColor || globalSettings.primaryColor || '#007bff',
                                        color: blockStyle.textColor || '#ffffff',
                                        textAlign: 'left',
                                        fontWeight: 'bold'
                                    }}>
                                        {header}
                                    </th>
                                ))}
                            </tr>
                            </thead>
                            <tbody>
                            {rows.map((row) => (
                                <tr key={row.id}>
                                    {row.cells.map((cell, index) => (
                                        <td key={index} style={{
                                            padding: '12px',
                                            border: '1px solid #dee2e6',
                                            backgroundColor: '#ffffff'
                                        }}>
                                            {cell}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                            </tbody>
                        </table>
                    </div>
                );
            }

            case 'spacer': {
                const height = block.props.spacerHeight || '40px';
                return (
                    <div
                        style={{
                            height,
                            backgroundColor: blockStyle.backgroundColor || 'transparent',
                            border: isSelected ? '1px dashed #007bff' : '1px dashed transparent',
                            borderRadius: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#999',
                            fontSize: '12px'
                        }}
                        role="separator"
                        aria-label={`Espaçador de ${height}`}
                    >
                        {isSelected ? `Espaçador (${height})` : ''}
                    </div>
                );
            }

            case 'social': {
                const defaultLinks: SocialLink[] = [
                    { id: 'facebook', name: 'Facebook', url: '#' },
                    { id: 'instagram', name: 'Instagram', url: '#' },
                    { id: 'twitter', name: 'Twitter', url: '#' },
                ];

                const socialLinks = block.props.socialLinks || defaultLinks;
                const iconSize = parseInt(blockStyle.iconSize || '24', 10);
                const iconColor = blockStyle.iconColor || globalSettings.textColor || '#333333';

                const iconMap: Record<string, React.ReactElement> = {
                    facebook: <FacebookLogo size={iconSize} color={iconColor} weight="fill" />,
                    instagram: <InstagramLogo size={iconSize} color={iconColor} weight="fill" />,
                    twitter: <TwitterLogo size={iconSize} color={iconColor} weight="fill" />,
                    linkedin: <LinkedinLogo size={iconSize} color={iconColor} weight="fill" />,
                    youtube: <YoutubeLogo size={iconSize} color={iconColor} weight="fill" />,
                    tiktok: <TiktokLogo size={iconSize} color={iconColor} weight="fill" />,
                    whatsapp: <WhatsappLogo size={iconSize} color={iconColor} weight="fill" />,
                    telegram: <TelegramLogo size={iconSize} color={iconColor} weight="fill" />,
                    github: <GithubLogo size={iconSize} color={iconColor} weight="fill" />,
                    dribbble: <DribbbleLogo size={iconSize} color={iconColor} weight="fill" />,
                    behance: <BehanceLogo size={iconSize} color={iconColor} weight="fill" />,
                    email: <At size={iconSize} color={iconColor} weight="bold" />,
                    website: <LinkIconPhosphor size={iconSize} color={iconColor} weight="bold" />,
                };

                return (
                    <div
                        style={{
                            textAlign: blockStyle.textAlign || 'center',
                        }}
                        role="navigation"
                        aria-label="Links de redes sociais"
                    >
                        {socialLinks.filter(link => link.url).map(link => (
                            <a
                                key={link.id}
                                href={link.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                    display: 'inline-block',
                                    margin: `0 ${iconSize / 4}px`
                                }}
                                title={link.name}
                                aria-label={`${link.name} - abre em nova aba`}
                            >
                                {iconMap[link.id]}
                            </a>
                        ))}
                    </div>
                );
            }

            default:
                return null;
        }
    };

    // Cada tipo de bloco controla seus próprios estilos visuais internamente.
    // O BlockContainer é responsável apenas por: margin (espaçamento externo),
    // padding (espaçamento interno) e o indicador de seleção (border azul).
    // Estilos visuais (backgroundColor, border custom, borderRadius) que já são
    // aplicados pelo elemento interno do bloco são removidos do container para
    // evitar dupla-aplicação.
    const containerBlockStyle = (() => {
        switch (block.type) {
            case 'button':
                // backgroundColor → <button> interno
                return { ...blockStyle, backgroundColor: undefined };
            case 'table':
                // backgroundColor → <th> dos cabeçalhos
                return { ...blockStyle, backgroundColor: undefined };
            case 'columns':
                // backgroundColor → divs de cada coluna
                return { ...blockStyle, backgroundColor: undefined };
            case 'text':
            case 'heading':
                // TextBlockWrapper já aplica backgroundColor, border e borderRadius
                return { ...blockStyle, backgroundColor: undefined, borderRadius: undefined };
            case 'spacer':
                // Padding do container distorceria a altura configurada do spacer
                return { ...blockStyle, padding: '0', paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0 };
            default:
                return blockStyle;
        }
    })();

    return (
        <BlockContainer
            $isSelected={isSelected && !isEditing}
            $blockStyle={containerBlockStyle}
            onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!isEditing) {
                    onClick(e);
                }
            }}
            role="article"
            aria-label={`Bloco ${block.type}${isSelected ? ' - selecionado' : ''}`}
        >
            {renderBlock()}
        </BlockContainer>
    );
}, (prevProps, nextProps) => {
    return (
        prevProps.block.id === nextProps.block.id &&
        prevProps.isSelected === nextProps.isSelected &&
        JSON.stringify(prevProps.block.props) === JSON.stringify(nextProps.block.props) &&
        JSON.stringify(prevProps.block.style) === JSON.stringify(nextProps.block.style) &&
        JSON.stringify(prevProps.globalSettings) === JSON.stringify(nextProps.globalSettings)
    );
});

BlockRenderer.displayName = 'BlockRenderer';