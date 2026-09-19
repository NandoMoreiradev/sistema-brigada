import React from 'react';
import styled from 'styled-components';
import { Editor } from '@tiptap/react';
// Imports "type-only" só para carregar as extensões de módulo (`declare module
// '@tiptap/core'`) que adicionam os comandos (toggleBold, setLink, etc.) usados
// abaixo via editor.chain() — sem custo de runtime (nenhum useEditor() real
// roda neste diretório, ver EmailBuilder.tsx/BlockRenderer.tsx).
import type {} from '@tiptap/starter-kit';
import type {} from '@tiptap/extension-underline';
import type {} from '@tiptap/extension-link';
import type {} from '@tiptap/extension-color';
import type {} from '@tiptap/extension-highlight';
import type {} from '@tiptap/extension-text-align';
import {
    TextBolder,
    TextItalic,
    TextUnderline,
    TextStrikethrough,
    TextAlignLeft,
    TextAlignCenter,
    TextAlignRight,
    TextHTwo,
    TextHThree,
    ListBullets,
    ListNumbers,
    Quotes,
    Link as LinkIcon,
    ArrowUUpLeft,
    ArrowUUpRight,
    Eraser,
    BracketsCurly,
    PaintBucket,
    TextAa
} from 'phosphor-react';
import { MergeTagPicker } from '../../common/MergeTagPicker';

/**
 * ============================================================================
 * TOOLBAR CUSTOMIZADA PARA BLOCOS DE TEXTO
 * ============================================================================
 * Toolbar completa com todas as opções de formatação para o EmailBuilder
 * ============================================================================
 */

interface TextBlockToolbarProps {
    editor: Editor | null;
    onMergeTagSelect: (tagName: string) => void;
}

export const TextBlockToolbar: React.FC<TextBlockToolbarProps> = ({ editor, onMergeTagSelect }) => {
    const [isLinkEditorOpen, setIsLinkEditorOpen] = React.useState(false);
    const [linkUrl, setLinkUrl] = React.useState('');

    if (!editor) return null;

    const handleLinkClick = () => {
        if (editor.isActive('link')) {
            const existingUrl = editor.getAttributes('link').href;
            setLinkUrl(existingUrl);
        }
        setIsLinkEditorOpen(!isLinkEditorOpen);
    };

    const handleLinkSubmit = () => {
        if (linkUrl === '') {
            editor.chain().focus().extendMarkRange('link').unsetLink().run();
        } else {
            editor.chain().focus().extendMarkRange('link').setLink({ href: linkUrl }).run();
        }
        setIsLinkEditorOpen(false);
        setLinkUrl('');
    };

    const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        editor.chain().focus().setColor(e.target.value).run();
    };

    const handleHighlightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        editor.chain().focus().toggleHighlight({ color: e.target.value }).run();
    };

    return (
        <ToolbarContainer>
            {/* Merge Tags */}
            <ToolbarSection>
                <MergeTagPicker onSelect={onMergeTagSelect}>
                    <ToolbarButton
                        type="button"
                        title="Inserir Variável (ou digite {{)"
                        aria-label="Inserir merge tag"
                    >
                        <BracketsCurly size={18} weight="bold" />
                    </ToolbarButton>
                </MergeTagPicker>
            </ToolbarSection>

            <Divider />

            {/* Formatação Básica */}
            <ToolbarSection>
                <ToolbarButton
                    type="button"
                    onClick={() => editor.chain().focus().toggleBold().run()}
                    $isActive={editor.isActive('bold')}
                    title="Negrito (Ctrl+B)"
                >
                    <TextBolder size={18} weight="bold" />
                </ToolbarButton>
                <ToolbarButton
                    type="button"
                    onClick={() => editor.chain().focus().toggleItalic().run()}
                    $isActive={editor.isActive('italic')}
                    title="Itálico (Ctrl+I)"
                >
                    <TextItalic size={18} />
                </ToolbarButton>
                <ToolbarButton
                    type="button"
                    onClick={() => editor.chain().focus().toggleUnderline().run()}
                    $isActive={editor.isActive('underline')}
                    title="Sublinhado (Ctrl+U)"
                >
                    <TextUnderline size={18} />
                </ToolbarButton>
                <ToolbarButton
                    type="button"
                    onClick={() => editor.chain().focus().toggleStrike().run()}
                    $isActive={editor.isActive('strike')}
                    title="Tachado"
                >
                    <TextStrikethrough size={18} />
                </ToolbarButton>
            </ToolbarSection>

            <Divider />

            {/* Cores */}
            <ToolbarSection>
                <ColorPickerWrapper>
                    <ColorPickerLabel>
                        <TextAa size={16} weight="bold" />
                    </ColorPickerLabel>
                    <ColorPicker
                        type="color"
                        value={editor.getAttributes('textStyle').color || '#1e293b'}
                        onChange={handleColorChange}
                        title="Cor do Texto"
                    />
                </ColorPickerWrapper>
                <ColorPickerWrapper>
                    <ColorPickerLabel>
                        <PaintBucket size={16} weight="fill" />
                    </ColorPickerLabel>
                    <ColorPicker
                        type="color"
                        value={editor.getAttributes('highlight').color || '#fef08a'}
                        onChange={handleHighlightChange}
                        title="Cor de Fundo"
                    />
                </ColorPickerWrapper>
            </ToolbarSection>

            <Divider />

            {/* Títulos */}
            <ToolbarSection>
                <ToolbarButton
                    type="button"
                    onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                    $isActive={editor.isActive('heading', { level: 2 })}
                    title="Título Grande"
                >
                    <TextHTwo size={18} />
                </ToolbarButton>
                <ToolbarButton
                    type="button"
                    onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                    $isActive={editor.isActive('heading', { level: 3 })}
                    title="Título Médio"
                >
                    <TextHThree size={18} />
                </ToolbarButton>
            </ToolbarSection>

            <Divider />

            {/* Listas */}
            <ToolbarSection>
                <ToolbarButton
                    type="button"
                    onClick={() => editor.chain().focus().toggleBulletList().run()}
                    $isActive={editor.isActive('bulletList')}
                    title="Lista com Marcadores"
                >
                    <ListBullets size={18} />
                </ToolbarButton>
                <ToolbarButton
                    type="button"
                    onClick={() => editor.chain().focus().toggleOrderedList().run()}
                    $isActive={editor.isActive('orderedList')}
                    title="Lista Numerada"
                >
                    <ListNumbers size={18} />
                </ToolbarButton>
            </ToolbarSection>

            <Divider />

            {/* Alinhamento */}
            <ToolbarSection>
                <ToolbarButton
                    type="button"
                    onClick={() => editor.chain().focus().setTextAlign('left').run()}
                    $isActive={editor.isActive({ textAlign: 'left' })}
                    title="Alinhar à Esquerda"
                >
                    <TextAlignLeft size={18} />
                </ToolbarButton>
                <ToolbarButton
                    type="button"
                    onClick={() => editor.chain().focus().setTextAlign('center').run()}
                    $isActive={editor.isActive({ textAlign: 'center' })}
                    title="Centralizar"
                >
                    <TextAlignCenter size={18} />
                </ToolbarButton>
                <ToolbarButton
                    type="button"
                    onClick={() => editor.chain().focus().setTextAlign('right').run()}
                    $isActive={editor.isActive({ textAlign: 'right' })}
                    title="Alinhar à Direita"
                >
                    <TextAlignRight size={18} />
                </ToolbarButton>
            </ToolbarSection>

            <Divider />

            {/* Blocos Especiais */}
            <ToolbarSection>
                <ToolbarButton
                    type="button"
                    onClick={() => editor.chain().focus().toggleBlockquote().run()}
                    $isActive={editor.isActive('blockquote')}
                    title="Citação"
                >
                    <Quotes size={18} />
                </ToolbarButton>
                <ToolbarButton
                    type="button"
                    onClick={handleLinkClick}
                    $isActive={editor.isActive('link')}
                    title="Inserir/Editar Link"
                >
                    <LinkIcon size={18} />
                </ToolbarButton>
            </ToolbarSection>

            <Divider />

            {/* Histórico */}
            <ToolbarSection>
                <ToolbarButton
                    type="button"
                    onClick={() => editor.chain().focus().undo().run()}
                    disabled={!editor.can().undo()}
                    title="Desfazer (Ctrl+Z)"
                >
                    <ArrowUUpLeft size={18} />
                </ToolbarButton>
                <ToolbarButton
                    type="button"
                    onClick={() => editor.chain().focus().redo().run()}
                    disabled={!editor.can().redo()}
                    title="Refazer (Ctrl+Y)"
                >
                    <ArrowUUpRight size={18} />
                </ToolbarButton>
            </ToolbarSection>

            <Divider />

            {/* Utilitários */}
            <ToolbarSection>
                <ToolbarButton
                    type="button"
                    onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
                    title="Limpar Formatação"
                >
                    <Eraser size={18} />
                </ToolbarButton>
            </ToolbarSection>

            {/* Link Editor */}
            {isLinkEditorOpen && (
                <LinkEditorContainer>
                    <LinkInput
                        type="url"
                        placeholder="Cole o URL... (Enter para confirmar)"
                        value={linkUrl}
                        onChange={(e) => setLinkUrl(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                handleLinkSubmit();
                            }
                            if (e.key === 'Escape') {
                                setIsLinkEditorOpen(false);
                                setLinkUrl('');
                            }
                        }}
                        autoFocus
                    />
                    <ToolbarButton
                        type="button"
                        onClick={handleLinkSubmit}
                        title="Confirmar"
                    >
                        ✓
                    </ToolbarButton>
                </LinkEditorContainer>
            )}
        </ToolbarContainer>
    );
};

// ============================================================================
// STYLED COMPONENTS
// ============================================================================

const ToolbarContainer = styled.div`
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 8px;
    background: linear-gradient(to bottom, #ffffff, #f8f9fa);
    border: 1px solid #dee2e6;
    border-radius: 8px 8px 0 0;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
    flex-wrap: wrap;
`;

const ToolbarSection = styled.div`
    display: flex;
    align-items: center;
    gap: 2px;
`;

const ToolbarButton = styled.button<{ $isActive?: boolean }>`
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 6px 8px;
    min-width: 32px;
    min-height: 32px;
    border: 1px solid transparent;
    border-radius: 6px;
    background: ${props => props.$isActive ? '#e7f0ff' : 'transparent'};
    color: ${props => props.$isActive ? '#0066cc' : '#495057'};
    cursor: pointer;
    transition: all 0.15s ease;

    &:hover:not(:disabled) {
        background: ${props => props.$isActive ? '#d0e4ff' : '#e9ecef'};
        border-color: #ced4da;
    }

    &:active:not(:disabled) {
        transform: scale(0.95);
    }

    &:disabled {
        opacity: 0.4;
        cursor: not-allowed;
    }

    &:focus-visible {
        outline: 2px solid #0066cc;
        outline-offset: 2px;
    }
`;

const Divider = styled.div`
    width: 1px;
    height: 24px;
    background: #dee2e6;
    margin: 0 4px;
`;

const ColorPickerWrapper = styled.div`
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    border-radius: 6px;
    background: #f8f9fa;
    border: 1px solid #dee2e6;
`;

const ColorPickerLabel = styled.div`
    display: flex;
    align-items: center;
    color: #6c757d;
`;

const ColorPicker = styled.input`
    width: 28px;
    height: 28px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    -webkit-appearance: none;
    -moz-appearance: none;
    appearance: none;

    &::-webkit-color-swatch-wrapper {
        padding: 0;
    }

    &::-webkit-color-swatch {
        border: 2px solid #dee2e6;
        border-radius: 4px;
    }

    &::-moz-color-swatch {
        border: 2px solid #dee2e6;
        border-radius: 4px;
    }
`;

const LinkEditorContainer = styled.div`
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: #f8f9fa;
    border-radius: 6px;
    margin-left: 8px;
    flex: 1;
    min-width: 200px;
`;

const LinkInput = styled.input`
    flex: 1;
    padding: 6px 10px;
    border: 1px solid #ced4da;
    border-radius: 4px;
    font-size: 13px;
    outline: none;

    &:focus {
        border-color: #0066cc;
        box-shadow: 0 0 0 3px rgba(0, 102, 204, 0.1);
    }
`;