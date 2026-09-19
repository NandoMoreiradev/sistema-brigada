/**
 * TextToolbar - Barra de Ferramentas de Formatação de Texto
 *
 * - Texto é editado NO CANVAS (contentEditable)
 * - Toolbar na SIDEBAR com botões de formatação
 * - Aplica formatação no texto selecionado no canvas
 */

import React, { useState } from 'react';
import styled from 'styled-components';
import {
    TextBolder, TextItalic, TextUnderline, TextStrikethrough,
    TextAlignLeft, TextAlignCenter, TextAlignRight, TextAlignJustify,
    TextHOne, TextHTwo, TextHThree,
    ListBullets, ListNumbers, Link as LinkIcon,
    BracketsCurly, PaintBucket, TextAa, Eraser,
    Quotes, TextIndent, TextOutdent, Minus,
    LinkBreak, Sun, ArrowCounterClockwise, ArrowClockwise,
    Table, Code
} from 'phosphor-react';
import type { ExtendedBlockProps, BlockStyle } from '../../types';
import { MergeTagPicker } from '../MergeTagPicker';
import { FONT_FAMILY_GROUPS } from '../../constants';

const Container = styled.div`
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 16px;
`;

const Section = styled.div`
    display: flex;
    flex-direction: column;
    gap: 8px;
`;

const SectionTitle = styled.h4`
    font-size: 12px;
    font-weight: 600;
    color: #6c757d;
    text-transform: uppercase;
    margin: 0;
`;

const ButtonGrid = styled.div`
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 6px;
`;

const ToolButton = styled.button<{ $active?: boolean }>`
    padding: 10px;
    background: ${props => props.$active ? '#007bff' : '#f8f9fa'};
    border: 1px solid ${props => props.$active ? '#007bff' : '#dee2e6'};
    border-radius: 6px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    color: ${props => props.$active ? 'white' : '#495057'};
    transition: all 0.2s;

    &:hover {
        background: ${props => props.$active ? '#0056b3' : '#e9ecef'};
        transform: translateY(-1px);
    }
`;

const ColorRow = styled.div`
    display: flex;
    gap: 8px;
    align-items: center;
`;

const ColorLabel = styled.span`
    font-size: 12px;
    color: #6c757d;
    min-width: 60px;
`;

const ColorInput = styled.input`
    width: 40px;
    height: 40px;
    border: 2px solid #dee2e6;
    border-radius: 6px;
    cursor: pointer;
`;

const InfoText = styled.p`
    font-size: 12px;
    color: #6c757d;
    margin: 0;
    padding: 12px;
    background: #e7f3ff;
    border-radius: 6px;
    border-left: 3px solid #007bff;
`;

const LinkInput = styled.input`
    width: 100%;
    padding: 8px;
    border: 1px solid #dee2e6;
    border-radius: 4px;
    font-size: 13px;
    margin-top: 8px;

    &:focus {
        outline: none;
        border-color: #007bff;
    }
`;

const FontSelect = styled.select`
    width: 100%;
    padding: 8px;
    border: 1px solid #dee2e6;
    border-radius: 4px;
    font-size: 13px;
    background: #fff;
    cursor: pointer;

    &:focus {
        outline: none;
        border-color: #007bff;
    }
`;

const SmallButton = styled.button`
    padding: 6px 12px;
    background: #007bff;
    color: white;
    border: none;
    border-radius: 4px;
    font-size: 12px;
    cursor: pointer;
    margin-top: 8px;

    &:hover {
        background: #0056b3;
    }
`;

interface TextToolbarProps {
    props: ExtendedBlockProps;
    style?: BlockStyle;
    blockType: 'heading' | 'text';
    onPropsChange: (newProps: ExtendedBlockProps) => void;
    onStyleChange?: (newStyle: BlockStyle) => void;
}

export const TextToolbar: React.FC<TextToolbarProps> = ({
    style,
    onStyleChange,
}) => {
    const [showLinkInput, setShowLinkInput] = useState(false);
    const [linkUrl, setLinkUrl] = useState('');
    const savedRangeRef = React.useRef<Range | null>(null);

    const execCommand = (command: string, value?: string) => {
        document.execCommand(command, false, value);
    };

    const handleInsertLink = () => {
        if (linkUrl) {
            execCommand('createLink', linkUrl);
            setLinkUrl('');
            setShowLinkInput(false);
        }
    };

    // Salva a posição do cursor quando o usuário interage com o texto
    const saveSelection = React.useCallback(() => {
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
            savedRangeRef.current = selection.getRangeAt(0).cloneRange();
        }
    }, []);

    // Restaura a seleção salva
    const restoreSelection = React.useCallback(() => {
        if (savedRangeRef.current) {
            const selection = window.getSelection();
            selection?.removeAllRanges();
            selection?.addRange(savedRangeRef.current);
        }
    }, []);

    const handleInsertTable = () => {
        const editableElement = document.querySelector('[contenteditable="true"]');
        if (!editableElement) return;

        // Cria uma tabela simples 3x3
        const table = document.createElement('table');
        table.style.borderCollapse = 'collapse';
        table.style.width = '100%';
        table.style.margin = '10px 0';
        table.contentEditable = 'true'; // Toda a tabela é editável

        for (let i = 0; i < 3; i++) {
            const row = table.insertRow();
            for (let j = 0; j < 3; j++) {
                const cell = row.insertCell();
                cell.style.border = '1px solid #dee2e6';
                cell.style.padding = '8px';
                cell.style.minWidth = '100px';
                cell.contentEditable = 'true'; // Células são editáveis
                cell.innerHTML = i === 0 ? `<strong>Cabeçalho ${j + 1}</strong>` : `Célula ${i},${j + 1}`;
            }
        }

        // Insere a tabela
        editableElement.appendChild(table);
        editableElement.appendChild(document.createElement('br'));
        editableElement.dispatchEvent(new Event('input', { bubbles: true }));
    };

    const handleInsertCodeBlock = () => {
        const editableElement = document.querySelector('[contenteditable="true"]');
        if (!editableElement) return;

        const pre = document.createElement('pre');
        pre.style.backgroundColor = '#f8f9fa';
        pre.style.padding = '12px';
        pre.style.borderRadius = '6px';
        pre.style.border = '1px solid #dee2e6';
        pre.style.fontFamily = 'monospace';
        pre.style.fontSize = '14px';
        pre.style.overflow = 'auto';
        pre.contentEditable = 'true'; // Bloco de código é editável

        const code = document.createElement('code');
        code.textContent = '// Seu código aqui';
        code.contentEditable = 'true'; // Conteúdo do código é editável
        pre.appendChild(code);

        editableElement.appendChild(pre);
        editableElement.appendChild(document.createElement('br'));
        editableElement.dispatchEvent(new Event('input', { bubbles: true }));
    };

    const handleInsertBlockquote = () => {
        const editableElement = document.querySelector('[contenteditable="true"]');
        if (!editableElement) return;

        const selection = window.getSelection();
        let selectedText = 'Citação aqui...';

        if (selection && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            selectedText = range.toString() || selectedText;
        }

        const blockquote = document.createElement('blockquote');
        blockquote.style.borderLeft = '4px solid #007bff';
        blockquote.style.paddingLeft = '16px';
        blockquote.style.margin = '16px 0';
        blockquote.style.color = '#6c757d';
        blockquote.style.fontStyle = 'italic';
        blockquote.contentEditable = 'true'; // Citação é editável
        blockquote.textContent = selectedText;

        if (selection && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            range.deleteContents();
            range.insertNode(blockquote);
        } else {
            editableElement.appendChild(blockquote);
            editableElement.appendChild(document.createElement('br'));
        }

        editableElement.dispatchEvent(new Event('input', { bubbles: true }));
    };

    const handleInsertMergeTag = (tag: string) => {
        // Primeiro, encontra o elemento contentEditable ativo
        const editableElement = document.querySelector('[contenteditable="true"]');

        if (!editableElement) {
            console.warn('Nenhum elemento editável encontrado');
            return;
        }

        // Foca no elemento editável
        (editableElement as HTMLElement).focus();

        // Restaura a seleção salva
        restoreSelection();

        // Insere a merge tag no cursor atual ou no final se não houver seleção
        const selection = window.getSelection();
        let range: Range;

        if (savedRangeRef.current) {
            // Usa a posição salva
            range = savedRangeRef.current;
        } else if (selection && selection.rangeCount > 0) {
            range = selection.getRangeAt(0);
        } else {
            // Se não houver seleção, cria um range no final do conteúdo
            range = document.createRange();
            range.selectNodeContents(editableElement);
            range.collapse(false);
        }

        // Cria o span estilizado para a merge tag
        const span = document.createElement('span');
        span.style.backgroundColor = '#e7f3ff';
        span.style.padding = '2px 6px';
        span.style.borderRadius = '3px';
        span.style.fontFamily = 'monospace';
        span.style.fontSize = '0.9em';
        span.style.color = '#0066cc';
        span.style.display = 'inline-block';
        span.contentEditable = 'false'; // Impede edição da tag
        span.textContent = tag;

        // Insere o span
        range.deleteContents();
        range.insertNode(span);

        // Adiciona um espaço após a tag para facilitar continuar digitando
        const space = document.createTextNode('\u00A0');
        range.setStartAfter(span);
        range.insertNode(space);

        // Move cursor para depois do espaço
        range.setStartAfter(space);
        range.setEndAfter(space);
        selection?.removeAllRanges();
        selection?.addRange(range);

        // Limpa a seleção salva
        savedRangeRef.current = null;

        // Dispara evento de input para salvar a mudança
        editableElement.dispatchEvent(new Event('input', { bubbles: true }));
    };

    return (
        <Container>
            <InfoText>
                ✏️ Selecione o texto no canvas e use os botões abaixo para formatar
            </InfoText>

            <Section>
                <SectionTitle>Desfazer / Refazer</SectionTitle>
                <ButtonGrid style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
                    <ToolButton onClick={() => execCommand('undo')} title="Desfazer (Ctrl+Z)">
                        <ArrowCounterClockwise size={18} />
                    </ToolButton>
                    <ToolButton onClick={() => execCommand('redo')} title="Refazer (Ctrl+Y)">
                        <ArrowClockwise size={18} />
                    </ToolButton>
                </ButtonGrid>
            </Section>

            <Section>
                <SectionTitle>Formatação Básica</SectionTitle>
                <ButtonGrid>
                    <ToolButton onClick={() => execCommand('bold')} title="Negrito (Ctrl+B)">
                        <TextBolder size={18} weight="bold" />
                    </ToolButton>
                    <ToolButton onClick={() => execCommand('italic')} title="Itálico (Ctrl+I)">
                        <TextItalic size={18} />
                    </ToolButton>
                    <ToolButton onClick={() => execCommand('underline')} title="Sublinhado (Ctrl+U)">
                        <TextUnderline size={18} />
                    </ToolButton>
                    <ToolButton onClick={() => execCommand('strikethrough')} title="Tachado">
                        <TextStrikethrough size={18} />
                    </ToolButton>
                </ButtonGrid>
            </Section>

            <Section>
                <SectionTitle>Formatação Avançada</SectionTitle>
                <ButtonGrid>
                    <ToolButton onClick={() => execCommand('subscript')} title="Subscrito">
                        <span style={{ fontSize: '14px' }}>X₂</span>
                    </ToolButton>
                    <ToolButton onClick={() => execCommand('superscript')} title="Sobrescrito">
                        <span style={{ fontSize: '14px' }}>X²</span>
                    </ToolButton>
                    <ToolButton onClick={() => execCommand('removeFormat')} title="Remover Formatação">
                        <Eraser size={18} />
                    </ToolButton>
                    <ToolButton onClick={() => execCommand('insertHorizontalRule')} title="Linha Horizontal">
                        <Minus size={18} />
                    </ToolButton>
                </ButtonGrid>
            </Section>

            <Section>
                <SectionTitle>Títulos</SectionTitle>
                <ButtonGrid>
                    <ToolButton onClick={() => execCommand('formatBlock', '<h1>')} title="Título 1">
                        <TextHOne size={18} />
                    </ToolButton>
                    <ToolButton onClick={() => execCommand('formatBlock', '<h2>')} title="Título 2">
                        <TextHTwo size={18} />
                    </ToolButton>
                    <ToolButton onClick={() => execCommand('formatBlock', '<h3>')} title="Título 3">
                        <TextHThree size={18} />
                    </ToolButton>
                    <ToolButton onClick={() => execCommand('formatBlock', '<p>')} title="Parágrafo">
                        <TextAa size={18} />
                    </ToolButton>
                </ButtonGrid>
            </Section>

            <Section>
                <SectionTitle>Alinhamento</SectionTitle>
                <ButtonGrid style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
                    <ToolButton onClick={() => execCommand('justifyLeft')} title="Esquerda">
                        <TextAlignLeft size={18} />
                    </ToolButton>
                    <ToolButton onClick={() => execCommand('justifyCenter')} title="Centro">
                        <TextAlignCenter size={18} />
                    </ToolButton>
                    <ToolButton onClick={() => execCommand('justifyRight')} title="Direita">
                        <TextAlignRight size={18} />
                    </ToolButton>
                    <ToolButton onClick={() => execCommand('justifyFull')} title="Justificar">
                        <TextAlignJustify size={18} />
                    </ToolButton>
                </ButtonGrid>
            </Section>

            <Section>
                <SectionTitle>Listas e Recuos</SectionTitle>
                <ButtonGrid>
                    <ToolButton onClick={() => execCommand('insertUnorderedList')} title="Lista com marcadores">
                        <ListBullets size={18} />
                    </ToolButton>
                    <ToolButton onClick={() => execCommand('insertOrderedList')} title="Lista numerada">
                        <ListNumbers size={18} />
                    </ToolButton>
                    <ToolButton onClick={() => execCommand('indent')} title="Aumentar recuo">
                        <TextIndent size={18} />
                    </ToolButton>
                    <ToolButton onClick={() => execCommand('outdent')} title="Diminuir recuo">
                        <TextOutdent size={18} />
                    </ToolButton>
                </ButtonGrid>
            </Section>

            <Section>
                <SectionTitle>Links e Variáveis</SectionTitle>
                <ButtonGrid style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                    <ToolButton
                        onClick={() => setShowLinkInput(!showLinkInput)}
                        title="Inserir Link"
                        $active={showLinkInput}
                    >
                        <LinkIcon size={18} />
                    </ToolButton>
                    <ToolButton onClick={() => execCommand('unlink')} title="Remover Link">
                        <LinkBreak size={18} />
                    </ToolButton>
                    <MergeTagPicker onSelect={handleInsertMergeTag}>
                        <ToolButton
                            as="div"
                            title="Inserir Variável"
                            onMouseDown={() => {
                                // Salva a seleção antes de abrir o popover
                                saveSelection();
                            }}
                        >
                            <BracketsCurly size={18} />
                        </ToolButton>
                    </MergeTagPicker>
                </ButtonGrid>
                {showLinkInput && (
                    <div>
                        <LinkInput
                            type="url"
                            placeholder="https://exemplo.com"
                            value={linkUrl}
                            onChange={(e) => setLinkUrl(e.target.value)}
                            onKeyPress={(e) => {
                                if (e.key === 'Enter') {
                                    handleInsertLink();
                                }
                            }}
                        />
                        <SmallButton onClick={handleInsertLink}>
                            Inserir Link
                        </SmallButton>
                    </div>
                )}
            </Section>

            <Section>
                <SectionTitle>Cores</SectionTitle>
                <ColorRow>
                    <ColorLabel>
                        <TextAa size={14} /> Texto:
                    </ColorLabel>
                    <ColorInput
                        type="color"
                        defaultValue="#000000"
                        onChange={(e) => execCommand('foreColor', e.target.value)}
                    />
                </ColorRow>
                <ColorRow>
                    <ColorLabel>
                        <Sun size={14} /> Destaque:
                    </ColorLabel>
                    <ColorInput
                        type="color"
                        defaultValue="#ffff00"
                        onChange={(e) => execCommand('backColor', e.target.value)}
                    />
                </ColorRow>
                <ColorRow>
                    <ColorLabel>
                        <PaintBucket size={14} /> Fundo:
                    </ColorLabel>
                    <ColorInput
                        type="color"
                        defaultValue={style?.backgroundColor || '#ffffff'}
                        onChange={(e) => {
                            if (onStyleChange) {
                                onStyleChange({ ...style, backgroundColor: e.target.value });
                            }
                        }}
                    />
                </ColorRow>
            </Section>

            <Section>
                <SectionTitle>Fonte</SectionTitle>
                <FontSelect
                    defaultValue=""
                    onChange={(e) => {
                        if (e.target.value) {
                            execCommand('fontName', e.target.value);
                            e.target.value = '';
                        }
                    }}
                >
                    <option value="" disabled>Selecione uma fonte...</option>
                    {FONT_FAMILY_GROUPS.map((group) => (
                        <optgroup key={group.group} label={group.group}>
                            {group.fonts.map((font) => (
                                <option key={font.value} value={font.value}>
                                    {font.label}
                                </option>
                            ))}
                        </optgroup>
                    ))}
                </FontSelect>
            </Section>

            <Section>
                <SectionTitle>Tamanho da Fonte</SectionTitle>
                <ButtonGrid style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                    <ToolButton onClick={() => execCommand('fontSize', '1')} title="Pequeno">
                        <span style={{ fontSize: '10px' }}>A</span>
                    </ToolButton>
                    <ToolButton onClick={() => execCommand('fontSize', '3')} title="Normal">
                        <span style={{ fontSize: '14px' }}>A</span>
                    </ToolButton>
                    <ToolButton onClick={() => execCommand('fontSize', '5')} title="Grande">
                        <span style={{ fontSize: '18px' }}>A</span>
                    </ToolButton>
                </ButtonGrid>
            </Section>

            <Section>
                <SectionTitle>Elementos Avançados</SectionTitle>
                <ButtonGrid style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                    <ToolButton onClick={handleInsertTable} title="Inserir Tabela 3x3">
                        <Table size={18} />
                    </ToolButton>
                    <ToolButton onClick={handleInsertCodeBlock} title="Inserir Bloco de Código">
                        <Code size={18} />
                    </ToolButton>
                    <ToolButton onClick={handleInsertBlockquote} title="Inserir Citação">
                        <Quotes size={18} />
                    </ToolButton>
                </ButtonGrid>
            </Section>
        </Container>
    );
};
