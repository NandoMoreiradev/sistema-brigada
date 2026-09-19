import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { Editor } from '@tiptap/react';
// Imports "type-only" só para carregar as extensões de módulo (`declare module
// '@tiptap/core'`) que adicionam os comandos (toggleBold, setLink, etc.) usados
// abaixo via editor.chain() — sem custo de runtime.
import type {} from '@tiptap/starter-kit';
import type {} from '@tiptap/extension-underline';
import type {} from '@tiptap/extension-link';
import type {} from '@tiptap/extension-color';
import type {} from '@tiptap/extension-highlight';
import type {} from '@tiptap/extension-text-align';
import {
    TextBolder, TextItalic, TextUnderline, TextStrikethrough,
    TextAlignLeft, TextAlignCenter, TextAlignRight,
    TextHTwo, TextHThree, ListBullets, ListNumbers,
    Quotes, Link as LinkIcon, Eraser, Check, X,
    BracketsCurly, PaintBucket, TextAa
} from 'phosphor-react';
import { MergeTagPicker } from '../../common/MergeTagPicker';

// =============================================================================
// INTERFACES
// =============================================================================

interface TextPropertiesEnhancedProps {
    editor: Editor | null;
    // Props de estilo do container
    backgroundColor?: string;
    padding?: { top: number; right: number; bottom: number; left: number };
    margin?: { top: number; right: number; bottom: number; left: number };
    borderColor?: string;
    borderWidth?: number;
    borderRadius?: number;
    // Callbacks
    onBackgroundColorChange?: (color: string) => void;
    onPaddingChange?: (padding: any) => void;
    onMarginChange?: (margin: any) => void;
    onBorderColorChange?: (color: string) => void;
    onBorderWidthChange?: (width: number) => void;
    onBorderRadiusChange?: (radius: number) => void;
}

// =============================================================================
// COMPONENTE PRINCIPAL
// =============================================================================

export const TextPropertiesEnhanced: React.FC<TextPropertiesEnhancedProps> = ({
                                                                                  editor,
                                                                                  backgroundColor = 'transparent',
                                                                                  padding,
                                                                                  margin,
                                                                                  borderColor,
                                                                                  borderWidth,
                                                                                  borderRadius,
                                                                                  onBackgroundColorChange,
                                                                                  onPaddingChange,
                                                                                  onMarginChange,
                                                                                  onBorderColorChange,
                                                                                  onBorderWidthChange,
                                                                                  onBorderRadiusChange,
                                                                              }) => {
    const [isLinkEditorOpen, setIsLinkEditorOpen] = useState(false);
    const [linkUrl, setLinkUrl] = useState('');
    const [textColor, setTextColor] = useState('#1e293b');
    const [highlightColor, setHighlightColor] = useState('#fef08a');
    const [isEditorActive, setIsEditorActive] = useState(false);

    // Helper para evitar o erro "The specified value 'transparent' does not conform"
    // Se a cor for transparente ou inválida, mostramos branco no seletor visualmente
    const safeColorValue = (color: string | undefined) => {
        if (!color || color === 'transparent' || !color.startsWith('#')) {
            return '#ffffff';
        }
        return color;
    };

    // Detecta estado do editor e atualiza UI
    useEffect(() => {
        if (!editor) {
            setIsEditorActive(false);
            return;
        }

        setIsEditorActive(true);

        const updateState = () => {
            // Atualiza cores baseado na seleção ou na posição do cursor
            const currentTextColor = editor.getAttributes('textStyle').color || '#1e293b';
            const currentHighlight = editor.getAttributes('highlight').color || '#fef08a';
            setTextColor(currentTextColor);
            setHighlightColor(currentHighlight);

            if (editor.isActive('link')) {
                const href = editor.getAttributes('link').href;
                setLinkUrl(href || '');
            }
        };

        editor.on('selectionUpdate', updateState);
        editor.on('update', updateState);
        editor.on('focus', updateState);

        // Inicializa estado
        updateState();

        return () => {
            editor.off('selectionUpdate', updateState);
            editor.off('update', updateState);
            editor.off('focus', updateState);
        };
    }, [editor]);

    const handleMergeTagSelect = (tagValue: string) => {
        if (!editor) return;
        // Focamos primeiro para garantir que o editor receba o comando
        editor.chain().focus().insertContent(`{{${tagValue}}}`).run();
    };

    const handleLinkClick = () => {
        if (!editor) return;
        if (editor.isActive('link')) {
            const existingUrl = editor.getAttributes('link').href;
            setLinkUrl(existingUrl);
        } else {
            setLinkUrl('');
        }
        setIsLinkEditorOpen(!isLinkEditorOpen);
    };

    const handleSetLink = () => {
        if (!editor) return;
        if (linkUrl === '') {
            editor.chain().focus().extendMarkRange('link').unsetLink().run();
        } else {
            editor.chain().focus().extendMarkRange('link').setLink({ href: linkUrl }).run();
        }
        setIsLinkEditorOpen(false);
        setLinkUrl('');
    };

    const handleRemoveLink = () => {
        if (!editor) return;
        editor.chain().focus().unsetLink().run();
        setIsLinkEditorOpen(false);
        setLinkUrl('');
    };

    const handleTextColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!editor) return;
        const color = e.target.value;
        setTextColor(color);
        editor.chain().focus().setColor(color).run();
    };

    const handleHighlightColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!editor) return;
        const color = e.target.value;
        setHighlightColor(color);
        editor.chain().focus().toggleHighlight({ color }).run();
    };

    if (!editor) {
        return (
            <PropertiesContainer>
                <InfoMessage>
                    💡 Clique em um bloco de texto para começar a editar
                </InfoMessage>
            </PropertiesContainer>
        );
    }

    return (
        <PropertiesContainer>
            {/* Header */}
            <SectionHeader>
                <HeaderTitle>✏️ Editor de Texto</HeaderTitle>
                <HeaderSubtitle>Formate o conteúdo selecionado</HeaderSubtitle>
            </SectionHeader>

            {/* Sempre mostra as ferramentas se o editor estiver presente */}
            {isEditorActive && (
                <>
                    {/* Merge Tags */}
                    <Section>
                        <SectionTitle>Variáveis Dinâmicas</SectionTitle>
                        <MergeTagPicker onSelect={handleMergeTagSelect}>
                            <FullWidthButton>
                                <BracketsCurly size={18} weight="bold" />
                                Inserir Variável
                            </FullWidthButton>
                        </MergeTagPicker>
                        <HeaderSubtitle style={{ marginTop: '4px', fontSize: '11px' }}>
                            Posicione o cursor onde deseja inserir a variável
                        </HeaderSubtitle>
                    </Section>

                    <Divider />

                    {/* Formatação Básica */}
                    <Section>
                        <SectionTitle>Formatação</SectionTitle>
                        <ButtonGrid>
                            <FormatButton
                                onClick={() => editor.chain().focus().toggleBold().run()}
                                $isActive={editor.isActive('bold')}
                                title="Negrito (Ctrl+B)"
                            >
                                <TextBolder size={18} weight="bold" />
                            </FormatButton>
                            <FormatButton
                                onClick={() => editor.chain().focus().toggleItalic().run()}
                                $isActive={editor.isActive('italic')}
                                title="Itálico (Ctrl+I)"
                            >
                                <TextItalic size={18} />
                            </FormatButton>
                            <FormatButton
                                onClick={() => editor.chain().focus().toggleUnderline().run()}
                                $isActive={editor.isActive('underline')}
                                title="Sublinhado (Ctrl+U)"
                            >
                                <TextUnderline size={18} />
                            </FormatButton>
                            <FormatButton
                                onClick={() => editor.chain().focus().toggleStrike().run()}
                                $isActive={editor.isActive('strike')}
                                title="Tachado"
                            >
                                <TextStrikethrough size={18} />
                            </FormatButton>
                        </ButtonGrid>
                    </Section>

                    <Divider />

                    {/* Cores */}
                    <Section>
                        <SectionTitle>Cores</SectionTitle>
                        <ColorRow>
                            <ColorLabel>
                                <TextAa size={16} weight="bold" />
                                Texto:
                            </ColorLabel>
                            <ColorPickerWrapper>
                                <ColorPickerInput
                                    type="color"
                                    value={safeColorValue(textColor)}
                                    onChange={handleTextColorChange}
                                    title="Cor do Texto"
                                />
                                <ColorValue>{textColor}</ColorValue>
                            </ColorPickerWrapper>
                        </ColorRow>
                        <ColorRow>
                            <ColorLabel>
                                <PaintBucket size={16} weight="fill" />
                                Fundo:
                            </ColorLabel>
                            <ColorPickerWrapper>
                                <ColorPickerInput
                                    type="color"
                                    value={safeColorValue(highlightColor)}
                                    onChange={handleHighlightColorChange}
                                    title="Cor de Fundo"
                                />
                                <ColorValue>{highlightColor}</ColorValue>
                            </ColorPickerWrapper>
                        </ColorRow>
                    </Section>

                    <Divider />

                    {/* Títulos */}
                    <Section>
                        <SectionTitle>Títulos</SectionTitle>
                        <ButtonGrid>
                            <FormatButton
                                onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                                $isActive={editor.isActive('heading', { level: 2 })}
                                title="Título Grande"
                            >
                                <TextHTwo size={18} />
                            </FormatButton>
                            <FormatButton
                                onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                                $isActive={editor.isActive('heading', { level: 3 })}
                                title="Título Médio"
                            >
                                <TextHThree size={18} />
                            </FormatButton>
                        </ButtonGrid>
                    </Section>

                    <Divider />

                    {/* Listas */}
                    <Section>
                        <SectionTitle>Listas</SectionTitle>
                        <ButtonGrid columns={3}>
                            <FormatButton
                                onClick={() => editor.chain().focus().toggleBulletList().run()}
                                $isActive={editor.isActive('bulletList')}
                                title="Lista com Marcadores"
                            >
                                <ListBullets size={18} />
                            </FormatButton>
                            <FormatButton
                                onClick={() => editor.chain().focus().toggleOrderedList().run()}
                                $isActive={editor.isActive('orderedList')}
                                title="Lista Numerada"
                            >
                                <ListNumbers size={18} />
                            </FormatButton>
                            <FormatButton
                                onClick={() => editor.chain().focus().toggleBlockquote().run()}
                                $isActive={editor.isActive('blockquote')}
                                title="Citação"
                            >
                                <Quotes size={18} />
                            </FormatButton>
                        </ButtonGrid>
                    </Section>

                    <Divider />

                    {/* Alinhamento */}
                    <Section>
                        <SectionTitle>Alinhamento</SectionTitle>
                        <ButtonGrid columns={3}>
                            <FormatButton
                                onClick={() => editor.chain().focus().setTextAlign('left').run()}
                                $isActive={editor.isActive({ textAlign: 'left' })}
                                title="Esquerda"
                            >
                                <TextAlignLeft size={18} />
                            </FormatButton>
                            <FormatButton
                                onClick={() => editor.chain().focus().setTextAlign('center').run()}
                                $isActive={editor.isActive({ textAlign: 'center' })}
                                title="Centro"
                            >
                                <TextAlignCenter size={18} />
                            </FormatButton>
                            <FormatButton
                                onClick={() => editor.chain().focus().setTextAlign('right').run()}
                                $isActive={editor.isActive({ textAlign: 'right' })}
                                title="Direita"
                            >
                                <TextAlignRight size={18} />
                            </FormatButton>
                        </ButtonGrid>
                    </Section>

                    <Divider />

                    {/* Link */}
                    <Section>
                        <SectionTitle>Link</SectionTitle>
                        {isLinkEditorOpen ? (
                            <LinkInputContainer>
                                <LinkInput
                                    type="url"
                                    placeholder="https://exemplo.com"
                                    value={linkUrl}
                                    onChange={(e) => setLinkUrl(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            handleSetLink();
                                        }
                                        if (e.key === 'Escape') {
                                            setIsLinkEditorOpen(false);
                                            setLinkUrl('');
                                        }
                                    }}
                                    autoFocus
                                />
                                <LinkButtonGroup>
                                    <LinkButton $variant="primary" onClick={handleSetLink}>
                                        <Check size={16} weight="bold" />
                                        Confirmar
                                    </LinkButton>
                                    <LinkButton $variant="secondary" onClick={() => {
                                        setIsLinkEditorOpen(false);
                                        setLinkUrl('');
                                    }}>
                                        <X size={16} weight="bold" />
                                        Cancelar
                                    </LinkButton>
                                </LinkButtonGroup>
                                {editor.isActive('link') && (
                                    <LinkButton $variant="danger" onClick={handleRemoveLink}>
                                        Remover Link
                                    </LinkButton>
                                )}
                            </LinkInputContainer>
                        ) : (
                            <FormatButton
                                onClick={handleLinkClick}
                                $isActive={editor.isActive('link')}
                                style={{ width: '100%' }}
                            >
                                <LinkIcon size={18} />
                                {editor.isActive('link') ? 'Editar Link' : 'Inserir Link'}
                            </FormatButton>
                        )}
                    </Section>

                    <Divider />

                    {/* Limpar Formatação */}
                    <Section>
                        <FullWidthButton
                            onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
                        >
                            <Eraser size={18} />
                            Limpar Formatação
                        </FullWidthButton>
                    </Section>

                    <Divider />

                    {/* Estilo do Bloco */}
                    <Section>
                        <SectionTitle>🎨 Estilo do Bloco</SectionTitle>

                        {/* Cor de Fundo do Bloco */}
                        <PropertyRow>
                            <PropertyLabel>Cor de Fundo</PropertyLabel>
                            <ColorPickerWrapper>
                                <ColorPickerInput
                                    type="color"
                                    value={safeColorValue(backgroundColor)}
                                    onChange={(e) => onBackgroundColorChange?.(e.target.value)}
                                />
                                <ColorValue>{backgroundColor}</ColorValue>
                            </ColorPickerWrapper>
                        </PropertyRow>

                        {/* Espaçamento (Padding e Margin) - CORRIGIDO */}
                        <PropertyRow>
                            <PropertyLabel>📏 Espaçamento (px)</PropertyLabel>
                        </PropertyRow>
                        <SpacingGrid>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <PropertySubLabel>Interno (Padding)</PropertySubLabel>
                                <SpacingInput
                                    type="number"
                                    min="0"
                                    // Usamos 'top' como referência para o input
                                    value={padding?.top || 0}
                                    onChange={(e) => {
                                        const val = parseInt(e.target.value) || 0;
                                        // Aplica o mesmo valor para Top, Right, Bottom, Left
                                        onPaddingChange?.({
                                            top: val, right: val, bottom: val, left: val
                                        });
                                    }}
                                    title="Aplica o espaçamento interno em todos os lados"
                                />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <PropertySubLabel>Externo (Margin)</PropertySubLabel>
                                <SpacingInput
                                    type="number"
                                    min="0"
                                    // Usamos 'top' como referência para o input
                                    value={margin?.top || 0}
                                    onChange={(e) => {
                                        const val = parseInt(e.target.value) || 0;
                                        // Aplica o mesmo valor para Top, Right, Bottom, Left
                                        onMarginChange?.({
                                            top: val, right: val, bottom: val, left: val
                                        });
                                    }}
                                    title="Aplica o espaçamento externo em todos os lados"
                                />
                            </div>
                        </SpacingGrid>

                        {/* Bordas */}
                        <PropertyRow>
                            <PropertyLabel>⬜ Bordas</PropertyLabel>
                        </PropertyRow>
                        <PropertyRow>
                            <ColorPickerWrapper style={{ flex: 1 }}>
                                <ColorPickerInput
                                    type="color"
                                    value={safeColorValue(borderColor)}
                                    onChange={(e) => onBorderColorChange?.(e.target.value)}
                                />
                                <PropertySubLabel>Cor da Borda</PropertySubLabel>
                            </ColorPickerWrapper>
                        </PropertyRow>
                        <SpacingGrid>
                            <SpacingInput
                                type="number"
                                placeholder="Largura"
                                min="0"
                                value={borderWidth || 0}
                                onChange={(e) => onBorderWidthChange?.(parseInt(e.target.value) || 0)}
                                title="Largura da Borda"
                            />
                            <SpacingInput
                                type="number"
                                placeholder="Raio (Curva)"
                                min="0"
                                value={borderRadius || 0}
                                onChange={(e) => onBorderRadiusChange?.(parseInt(e.target.value) || 0)}
                                title="Raio da Borda"
                            />
                        </SpacingGrid>
                    </Section>
                </>
            )}
        </PropertiesContainer>
    );
};

// =============================================================================
// STYLED COMPONENTS
// =============================================================================

const PropertiesContainer = styled.div`
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    background: white;
    height: 100%;
    overflow-y: auto;

    &::-webkit-scrollbar {
        width: 6px;
    }
    &::-webkit-scrollbar-track {
        background: #f8fafc;
    }
    &::-webkit-scrollbar-thumb {
        background: #cbd5e1;
        border-radius: 3px;
        &:hover { background: #94a3b8; }
    }
`;

const SectionHeader = styled.div`
    padding-bottom: 12px;
    border-bottom: 2px solid #e2e8f0;
`;

const HeaderTitle = styled.h3`
    font-size: 15px;
    font-weight: 600;
    color: #1e293b;
    margin: 0 0 4px 0;
`;

const HeaderSubtitle = styled.p`
    font-size: 12px;
    color: #64748b;
    margin: 0;
`;

const Section = styled.div`
    display: flex;
    flex-direction: column;
    gap: 10px;
`;

const SectionTitle = styled.h4`
    font-size: 12px;
    font-weight: 600;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin: 0;
`;

const ButtonGrid = styled.div<{ columns?: number }>`
    display: grid;
    grid-template-columns: repeat(${props => props.columns || 4}, 1fr);
    gap: 6px;
`;

const FormatButton = styled.button<{ $isActive?: boolean }>`
    background: ${props => props.$isActive ? '#3b82f6' : '#f8fafc'};
    border: 1px solid ${props => props.$isActive ? '#3b82f6' : '#e2e8f0'};
    border-radius: 6px;
    padding: 10px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    color: ${props => props.$isActive ? 'white' : '#475569'};
    transition: all 0.2s ease;
    min-height: 40px;
    font-size: 13px;
    font-weight: 500;

    &:hover:not(:disabled) {
        background: ${props => props.$isActive ? '#2563eb' : '#e2e8f0'};
        transform: translateY(-1px);
    }
    &:active { transform: scale(0.95); }
    &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

const FullWidthButton = styled(FormatButton)`
    width: 100%;
`;

const ColorRow = styled.div`
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px;
    background: #f8fafc;
    border-radius: 6px;
`;

const ColorLabel = styled.span`
    font-size: 12px;
    color: #64748b;
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 60px;
`;

const ColorPickerWrapper = styled.label`
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    flex: 1;
`;

const ColorPickerInput = styled.input`
    width: 40px;
    height: 40px;
    border: 2px solid #e2e8f0;
    border-radius: 6px;
    cursor: pointer;
    background: transparent;

    &::-webkit-color-swatch-wrapper { padding: 2px; border-radius: 4px; }
    &::-webkit-color-swatch { border: none; border-radius: 4px; }
    &::-moz-color-swatch { border: none; border-radius: 4px; }
`;

const ColorValue = styled.span`
    font-size: 11px;
    color: #94a3b8;
    font-family: 'Monaco', 'Courier New', monospace;
`;

const LinkInputContainer = styled.div`
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 10px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
`;

const LinkInput = styled.input`
    background-color: white;
    color: #1e293b;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 8px 12px;
    font-size: 13px;
    outline: none;

    &:focus { border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1); }
    &::placeholder { color: #94a3b8; }
`;

const LinkButtonGroup = styled.div`
    display: flex;
    gap: 6px;
`;

const LinkButton = styled.button<{ $variant?: 'primary' | 'secondary' | 'danger' }>`
    flex: 1;
    padding: 8px 12px;
    border-radius: 6px;
    border: none;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    transition: all 0.2s ease;

    ${props => props.$variant === 'primary' && `
        background: #3b82f6;
        color: white;
        &:hover { background: #2563eb; }
    `}
    ${props => props.$variant === 'secondary' && `
        background: #f8fafc;
        color: #64748b;
        border: 1px solid #e2e8f0;
        &:hover { background: #e2e8f0; }
    `}
    ${props => props.$variant === 'danger' && `
        background: #fee;
        color: #dc2626;
        &:hover { background: #fdd; }
    `}
    &:active { transform: scale(0.95); }
`;

const Divider = styled.div`
    height: 1px;
    background: #e2e8f0;
    margin: 4px 0;
`;

const InfoMessage = styled.div`
    padding: 16px;
    background: #f0f9ff;
    border: 1px solid #bae6fd;
    border-radius: 8px;
    color: #0c4a6e;
    font-size: 13px;
    line-height: 1.5;
    text-align: center;
`;

const PropertyRow = styled.div`
    display: flex;
    align-items: center;
    gap: 10px;
`;

const PropertyLabel = styled.span`
    font-size: 12px;
    color: #475569;
    font-weight: 500;
`;

const PropertySubLabel = styled.span`
    font-size: 11px;
    color: #94a3b8;
    margin-bottom: 4px;
`;

const SpacingGrid = styled.div`
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
`;

const SpacingInput = styled.input`
    padding: 8px;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    font-size: 12px;
    outline: none;
    width: 100%;

    &:focus { border-color: #3b82f6; }
`;