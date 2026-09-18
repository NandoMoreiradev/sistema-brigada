/**
 * TextPropertiesSidebar - Editor de Texto Rico 100% na Sidebar
 *
 * FILOSOFIA:
 * - TODO o texto é editado APENAS na barra lateral
 * - Canvas exibe preview estático (não editável)
 * - Editor WYSIWYG completo com todas as ferramentas
 * - Sem dependência de TipTap inline
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import styled from 'styled-components';
import {
    TextBolder, TextItalic, TextUnderline, TextStrikethrough,
    TextAlignLeft, TextAlignCenter, TextAlignRight, TextAlignJustify,
    TextHOne, TextHTwo, TextHThree,
    ListBullets, ListNumbers, Link as LinkIcon,
    BracketsCurly, PaintBucket, TextAa, Eraser,
    Eye, Code, ArrowCounterClockwise, ArrowClockwise
} from 'phosphor-react';
import type { ExtendedBlockProps, BlockStyle } from '../../types';
import { MergeTagPicker } from '@/components/email-builder/components/MergeTagPicker';

// =============================================================================
// INTERFACES
// =============================================================================

interface TextPropertiesSidebarProps {
    props: ExtendedBlockProps;
    style?: BlockStyle;
    blockType: 'heading' | 'text';
    onPropsChange: (newProps: ExtendedBlockProps) => void;
    onStyleChange?: (newStyle: BlockStyle) => void;
}

// =============================================================================
// HELPERS
// =============================================================================

const execCommand = (command: string, value?: string) => {
    document.execCommand(command, false, value);
};

// =============================================================================
// COMPONENTE PRINCIPAL
// =============================================================================

export const TextPropertiesSidebar: React.FC<TextPropertiesSidebarProps> = ({
    props,
    style = {},
    blockType,
    onPropsChange,
    onStyleChange,
}) => {
    console.log('🎨 TextPropertiesSidebar renderizado', { props, style, blockType });

    const editorRef = useRef<HTMLDivElement>(null);
    const [showHTMLSource, setShowHTMLSource] = useState(false);
    const [htmlSource, setHtmlSource] = useState(props.children || '');
    const [linkUrl, setLinkUrl] = useState('');
    const [showLinkInput, setShowLinkInput] = useState(false);
    const [textColor, setTextColor] = useState(style.textColor || '#000000');
    const [bgColor, setBgColor] = useState(style.backgroundColor || 'transparent');

    // Sincroniza conteúdo inicial
    useEffect(() => {
        if (editorRef.current && !showHTMLSource) {
            const content = props.children || '<p>Digite seu texto aqui...</p>';
            if (editorRef.current.innerHTML !== content) {
                editorRef.current.innerHTML = content;
            }
        }
    }, [props.children, showHTMLSource]);

    // Atualiza o conteúdo no estado pai
    const handleContentChange = useCallback(() => {
        if (editorRef.current) {
            const newContent = editorRef.current.innerHTML;
            onPropsChange({ ...props, children: newContent });
        }
    }, [props, onPropsChange]);

    // Toolbar actions
    const handleBold = () => execCommand('bold');
    const handleItalic = () => execCommand('italic');
    const handleUnderline = () => execCommand('underline');
    const handleStrike = () => execCommand('strikethrough');

    const handleHeading = (level: 1 | 2 | 3) => {
        execCommand('formatBlock', `<h${level}>`);
        handleContentChange();
    };

    const handleAlign = (alignment: 'left' | 'center' | 'right' | 'justify') => {
        const commands = {
            left: 'justifyLeft',
            center: 'justifyCenter',
            right: 'justifyRight',
            justify: 'justifyFull',
        };
        execCommand(commands[alignment]);
        handleContentChange();
    };

    const handleList = (type: 'ul' | 'ol') => {
        execCommand(type === 'ul' ? 'insertUnorderedList' : 'insertOrderedList');
        handleContentChange();
    };

    const handleTextColor = (color: string) => {
        setTextColor(color);
        execCommand('foreColor', color);
        handleContentChange();
    };

    const handleBackgroundColor = (color: string) => {
        setBgColor(color);
        if (onStyleChange) {
            onStyleChange({ ...style, backgroundColor: color });
        }
    };

    const handleInsertLink = () => {
        if (linkUrl) {
            execCommand('createLink', linkUrl);
            setLinkUrl('');
            setShowLinkInput(false);
            handleContentChange();
        }
    };

    const handleMergeTag = (tag: string) => {
        if (editorRef.current) {
            editorRef.current.focus();
            execCommand('insertText', `{{${tag}}}`);
            handleContentChange();
        }
    };

    const handleUndo = () => execCommand('undo');
    const handleRedo = () => execCommand('redo');

    const handleClearFormat = () => {
        execCommand('removeFormat');
        handleContentChange();
    };

    const toggleHTMLView = () => {
        if (showHTMLSource) {
            // Volta para visual, aplica HTML
            if (editorRef.current) {
                editorRef.current.innerHTML = htmlSource;
                handleContentChange();
            }
        } else {
            // Vai para HTML source
            if (editorRef.current) {
                setHtmlSource(editorRef.current.innerHTML);
            }
        }
        setShowHTMLSource(!showHTMLSource);
    };

    return (
        <Container>
            {/* Header */}
            <SectionHeader>
                <HeaderTitle>✏️ Editor de Texto</HeaderTitle>
                <HeaderSubtitle>
                    {blockType === 'heading' ? 'Título' : 'Parágrafo de texto'}
                </HeaderSubtitle>
            </SectionHeader>

            {/* Toolbar de Formatação */}
            <Toolbar>
                <ToolbarSection>
                    <SectionLabel>Desfazer/Refazer</SectionLabel>
                    <ButtonRow>
                        <ToolButton onClick={handleUndo} title="Desfazer (Ctrl+Z)">
                            <ArrowCounterClockwise size={16} />
                        </ToolButton>
                        <ToolButton onClick={handleRedo} title="Refazer (Ctrl+Y)">
                            <ArrowClockwise size={16} />
                        </ToolButton>
                    </ButtonRow>
                </ToolbarSection>

                <Divider />

                <ToolbarSection>
                    <SectionLabel>Formatação</SectionLabel>
                    <ButtonRow>
                        <ToolButton onClick={handleBold} title="Negrito">
                            <TextBolder size={16} weight="bold" />
                        </ToolButton>
                        <ToolButton onClick={handleItalic} title="Itálico">
                            <TextItalic size={16} />
                        </ToolButton>
                        <ToolButton onClick={handleUnderline} title="Sublinhado">
                            <TextUnderline size={16} />
                        </ToolButton>
                        <ToolButton onClick={handleStrike} title="Tachado">
                            <TextStrikethrough size={16} />
                        </ToolButton>
                    </ButtonRow>
                </ToolbarSection>

                <Divider />

                <ToolbarSection>
                    <SectionLabel>Títulos</SectionLabel>
                    <ButtonRow>
                        <ToolButton onClick={() => handleHeading(1)} title="Título 1">
                            <TextHOne size={16} />
                        </ToolButton>
                        <ToolButton onClick={() => handleHeading(2)} title="Título 2">
                            <TextHTwo size={16} />
                        </ToolButton>
                        <ToolButton onClick={() => handleHeading(3)} title="Título 3">
                            <TextHThree size={16} />
                        </ToolButton>
                    </ButtonRow>
                </ToolbarSection>

                <Divider />

                <ToolbarSection>
                    <SectionLabel>Alinhamento</SectionLabel>
                    <ButtonRow>
                        <ToolButton onClick={() => handleAlign('left')} title="Esquerda">
                            <TextAlignLeft size={16} />
                        </ToolButton>
                        <ToolButton onClick={() => handleAlign('center')} title="Centro">
                            <TextAlignCenter size={16} />
                        </ToolButton>
                        <ToolButton onClick={() => handleAlign('right')} title="Direita">
                            <TextAlignRight size={16} />
                        </ToolButton>
                        <ToolButton onClick={() => handleAlign('justify')} title="Justificar">
                            <TextAlignJustify size={16} />
                        </ToolButton>
                    </ButtonRow>
                </ToolbarSection>

                <Divider />

                <ToolbarSection>
                    <SectionLabel>Listas</SectionLabel>
                    <ButtonRow>
                        <ToolButton onClick={() => handleList('ul')} title="Lista com marcadores">
                            <ListBullets size={16} />
                        </ToolButton>
                        <ToolButton onClick={() => handleList('ol')} title="Lista numerada">
                            <ListNumbers size={16} />
                        </ToolButton>
                    </ButtonRow>
                </ToolbarSection>

                <Divider />

                <ToolbarSection>
                    <SectionLabel>Cores</SectionLabel>
                    <ColorRow>
                        <ColorPickerWrapper>
                            <ColorLabel>
                                <TextAa size={14} /> Texto:
                            </ColorLabel>
                            <ColorInput
                                type="color"
                                value={textColor}
                                onChange={(e) => handleTextColor(e.target.value)}
                            />
                        </ColorPickerWrapper>
                        <ColorPickerWrapper>
                            <ColorLabel>
                                <PaintBucket size={14} /> Fundo:
                            </ColorLabel>
                            <ColorInput
                                type="color"
                                value={bgColor === 'transparent' ? '#ffffff' : bgColor}
                                onChange={(e) => handleBackgroundColor(e.target.value)}
                            />
                        </ColorPickerWrapper>
                    </ColorRow>
                </ToolbarSection>

                <Divider />

                <ToolbarSection>
                    <SectionLabel>Link</SectionLabel>
                    {showLinkInput ? (
                        <LinkInputGroup>
                            <LinkInput
                                type="url"
                                placeholder="https://exemplo.com"
                                value={linkUrl}
                                onChange={(e) => setLinkUrl(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleInsertLink();
                                    }
                                }}
                            />
                            <SmallButtonRow>
                                <SmallButton onClick={handleInsertLink}>OK</SmallButton>
                                <SmallButton onClick={() => setShowLinkInput(false)}>Cancelar</SmallButton>
                            </SmallButtonRow>
                        </LinkInputGroup>
                    ) : (
                        <FullButton onClick={() => setShowLinkInput(true)}>
                            <LinkIcon size={16} /> Inserir Link
                        </FullButton>
                    )}
                </ToolbarSection>

                <Divider />

                <ToolbarSection>
                    <SectionLabel>Variáveis Dinâmicas</SectionLabel>
                    <MergeTagPicker onSelect={handleMergeTag}>
                        <FullButton>
                            <BracketsCurly size={16} /> Inserir Variável
                        </FullButton>
                    </MergeTagPicker>
                </ToolbarSection>

                <Divider />

                <ToolbarSection>
                    <ButtonRow>
                        <ToolButton onClick={toggleHTMLView} title="Ver código HTML">
                            <Code size={16} />
                        </ToolButton>
                        <ToolButton onClick={handleClearFormat} title="Limpar formatação">
                            <Eraser size={16} />
                        </ToolButton>
                    </ButtonRow>
                </ToolbarSection>
            </Toolbar>

            {/* Editor */}
            <EditorLabel>
                <Eye size={14} /> Conteúdo
            </EditorLabel>

            {showHTMLSource ? (
                <HTMLEditor
                    value={htmlSource}
                    onChange={(e) => setHtmlSource(e.target.value)}
                    placeholder="<p>Digite HTML aqui...</p>"
                    spellCheck={false}
                />
            ) : (
                <RichEditor
                    ref={editorRef}
                    contentEditable
                    onInput={handleContentChange}
                    onBlur={handleContentChange}
                    suppressContentEditableWarning
                    style={{
                        backgroundColor: bgColor !== 'transparent' ? bgColor : undefined,
                    }}
                />
            )}

            <HelpText>
                💡 Dica: Selecione o texto no editor acima e use os botões da toolbar para formatar
            </HelpText>
        </Container>
    );
};

// =============================================================================
// STYLED COMPONENTS
// =============================================================================

const Container = styled.div`
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;
    height: 100%;
    overflow-y: auto;
    background: #f8f9fa;
`;

const SectionHeader = styled.div`
    padding-bottom: 12px;
    border-bottom: 2px solid #e9ecef;
    background: white;
    padding: 12px;
    border-radius: 8px;
`;

const HeaderTitle = styled.h3`
    font-size: 15px;
    font-weight: 600;
    color: #212529;
    margin: 0 0 4px 0;
`;

const HeaderSubtitle = styled.p`
    font-size: 12px;
    color: #6c757d;
    margin: 0;
`;

const Toolbar = styled.div`
    background: white;
    border: 1px solid #dee2e6;
    border-radius: 8px;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 10px;
`;

const ToolbarSection = styled.div`
    display: flex;
    flex-direction: column;
    gap: 8px;
`;

const SectionLabel = styled.label`
    font-size: 11px;
    font-weight: 600;
    color: #6c757d;
    text-transform: uppercase;
    letter-spacing: 0.5px;
`;

const ButtonRow = styled.div`
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
`;

const ToolButton = styled.button`
    flex: 1;
    min-width: 40px;
    height: 36px;
    background: #f8f9fa;
    border: 1px solid #dee2e6;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: #495057;
    transition: all 0.2s;

    &:hover {
        background: #e9ecef;
        border-color: #adb5bd;
    }

    &:active {
        transform: scale(0.95);
    }
`;

const FullButton = styled(ToolButton)`
    width: 100%;
    gap: 8px;
    font-size: 13px;
    font-weight: 500;
`;

const Divider = styled.div`
    height: 1px;
    background: #dee2e6;
`;

const ColorRow = styled.div`
    display: flex;
    gap: 8px;
`;

const ColorPickerWrapper = styled.div`
    flex: 1;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px;
    background: #f8f9fa;
    border-radius: 6px;
`;

const ColorLabel = styled.span`
    font-size: 11px;
    color: #6c757d;
    display: flex;
    align-items: center;
    gap: 4px;
`;

const ColorInput = styled.input`
    width: 32px;
    height: 32px;
    border: 2px solid #dee2e6;
    border-radius: 4px;
    cursor: pointer;

    &::-webkit-color-swatch-wrapper {
        padding: 2px;
    }
    &::-webkit-color-swatch {
        border: none;
        border-radius: 2px;
    }
`;

const LinkInputGroup = styled.div`
    display: flex;
    flex-direction: column;
    gap: 6px;
`;

const LinkInput = styled.input`
    padding: 8px;
    border: 1px solid #ced4da;
    border-radius: 4px;
    font-size: 13px;

    &:focus {
        outline: none;
        border-color: #80bdff;
        box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.1);
    }
`;

const SmallButtonRow = styled.div`
    display: flex;
    gap: 4px;
`;

const SmallButton = styled.button`
    flex: 1;
    padding: 6px 12px;
    font-size: 12px;
    border: 1px solid #dee2e6;
    background: #f8f9fa;
    border-radius: 4px;
    cursor: pointer;

    &:hover {
        background: #e9ecef;
    }
`;

const EditorLabel = styled.label`
    font-size: 12px;
    font-weight: 600;
    color: #495057;
    display: flex;
    align-items: center;
    gap: 6px;
`;

const RichEditor = styled.div`
    min-height: 300px;
    max-height: 500px;
    overflow-y: auto;
    padding: 16px;
    border: 2px solid #ced4da;
    border-radius: 8px;
    background: white;
    font-size: 14px;
    line-height: 1.6;
    color: #212529;
    outline: none;

    &:focus {
        border-color: #80bdff;
        box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);
    }

    &[contenteditable="true"]:empty:before {
        content: attr(placeholder);
        color: #adb5bd;
    }

    h1, h2, h3 {
        margin: 16px 0 8px 0;
        font-weight: 600;
    }

    p {
        margin: 0 0 12px 0;
    }

    ul, ol {
        margin: 0 0 12px 20px;
        padding-left: 20px;
    }

    a {
        color: #007bff;
        text-decoration: underline;
    }
`;

const HTMLEditor = styled.textarea`
    min-height: 300px;
    max-height: 500px;
    padding: 16px;
    border: 2px solid #ced4da;
    border-radius: 8px;
    background: #f8f9fa;
    font-family: 'Monaco', 'Courier New', monospace;
    font-size: 12px;
    line-height: 1.5;
    color: #212529;
    resize: vertical;

    &:focus {
        outline: none;
        border-color: #80bdff;
        box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);
    }
`;

const HelpText = styled.p`
    font-size: 11px;
    color: #6c757d;
    margin: 0;
    font-style: italic;
`;
