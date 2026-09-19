import React, { useState, useEffect, useRef, useCallback } from 'react';
import styled from 'styled-components';
import { useDebouncedCallback } from 'use-debounce';
import {
    Palette,
    TextT,
    TextAlignLeft,
    TextAlignCenter,
    TextAlignRight,
    TextAlignJustify,
    PaintBrush,
    Ruler,
    FrameCorners,
    CheckCircle,
    X,
} from 'phosphor-react';

import type {
    ExtendedBlock,
    ExtendedBlockProps,
    BlockStyle,
    GlobalEmailSettings,
} from '../types';
import { FONT_FAMILY_GROUPS, FONT_SIZES, BLOCK_LABELS, BLOCK_ICONS } from '../constants';
import {
    StyleSection,
    StyleSectionTitle,
    StyleGrid,
    StyleRow,
    ColorPicker,
    Select,
    Label,
    AlignmentButtons,
    AlignButton,
} from '../styles';
import { tokens } from '../styles/tokens';

// Importamos todos os nossos componentes especializados
import { ImageProperties } from './properties-panels/ImageProperties';
import { ButtonProperties } from './properties-panels/ButtonProperties';
import { ListProperties } from './properties-panels/ListProperties';
import { ColumnsProperties } from './properties-panels/ColumnsProperties';
import { TableProperties } from './properties-panels/TableProperties';
import { SpacerProperties } from './properties-panels/SpacerProperties';
import { SocialProperties } from './properties-panels/SocialProperties';
import { TextToolbar } from './properties-panels/TextToolbar';
import { SpacingControl } from './properties-panels/SpacingControl';

// =============================================================================
// STYLED COMPONENTS
// =============================================================================

const PanelHeader = styled.div`
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 18px;
`;

const PanelHeaderIcon = styled.div`
    width: 32px;
    height: 32px;
    border-radius: ${tokens.radius.md};
    background: ${tokens.color.accentSoft};
    color: ${tokens.color.accent};
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
`;

const PanelTitle = styled.h3`
    margin: 0;
    flex-grow: 1;
    font-size: 15px;
    font-weight: 700;
    color: ${tokens.color.ink};
`;

const CloseIconButton = styled.button`
    all: unset;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: ${tokens.radius.md};
    color: ${tokens.color.faint};
    cursor: pointer;
    transition: all 0.15s ease;

    &:hover {
        background: ${tokens.color.surfaceAlt};
        color: ${tokens.color.ink};
    }
`;

const AutoSaveNote = styled.div`
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 20px;
    padding-top: 14px;
    border-top: 1px solid ${tokens.color.lineSoft};
    font-size: 12px;
    font-weight: 500;
    color: ${tokens.color.muted};

    svg { color: ${tokens.color.success}; }
`;

// =============================================================================
// INTERFACES
// =============================================================================

interface PropertiesPanelProps {
    block: ExtendedBlock;
    onUpdate: (id: string, newProps: ExtendedBlockProps, newStyle?: BlockStyle) => void;
    onClose: () => void;
    globalSettings: GlobalEmailSettings;
}

// =============================================================================
// COMPONENTE PRINCIPAL
// =============================================================================

export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({
                                                                    block,
                                                                    onUpdate,
                                                                    onClose,
                                                                    globalSettings,
                                                                }) => {
    const [props, setProps] = useState(block.props);
    const [style, setStyle] = useState<BlockStyle>(block.style || {});
    const [isDirty, setIsDirty] = useState(false);

    // Refs sempre com o valor mais recente, para o commit debounced enviar
    // props E estilo juntos (evita perda de alteração de conteúdo).
    const propsRef = useRef(props);
    const styleRef = useRef(style);
    propsRef.current = props;
    styleRef.current = style;

    // Atualizar estado local quando bloco muda (mas só se não estiver editando)
    useEffect(() => {
        if (!isDirty) {
            setProps(block.props);
            setStyle(block.style || {});
        }
    }, [block, isDirty]);

    // Commit unificado e debounced: persiste tanto props quanto estilo.
    const commit = useDebouncedCallback(() => {
        onUpdate(block.id, propsRef.current, styleRef.current);
        setIsDirty(false);
    }, 400);

    const handlePropsUpdate = useCallback((newProps: ExtendedBlockProps) => {
        setProps(newProps);
        setIsDirty(true);
        commit();
    }, [commit]);

    const handleStyleChange = useCallback((property: keyof BlockStyle, value: string) => {
        setStyle((prev) => ({ ...prev, [property]: value }));
        setIsDirty(true);
        commit();
    }, [commit]);

    const handleSpacingChange = useCallback((changes: Partial<BlockStyle>) => {
        setStyle((prev) => ({ ...prev, ...changes }));
        setIsDirty(true);
        commit();
    }, [commit]);

    const renderPropsFields = () => {
        switch (block.type) {
            case 'heading':
            case 'text':
                return (
                    <TextToolbar
                        props={props}
                        style={style}
                        blockType={block.type}
                        onPropsChange={handlePropsUpdate}
                        onStyleChange={(newStyle) => {
                            setStyle(newStyle);
                            setIsDirty(true);
                            commit();
                        }}
                    />
                );

            case 'button':
                return <ButtonProperties props={props} onPropsChange={handlePropsUpdate} />;

            case 'image':
                return <ImageProperties props={props} onPropsChange={handlePropsUpdate} />;

            case 'list':
                return <ListProperties props={props} onPropsChange={handlePropsUpdate} />;

            case 'columns':
                return <ColumnsProperties props={props} onPropsChange={handlePropsUpdate} />;

            case 'table':
                return <TableProperties props={props} onPropsChange={handlePropsUpdate} />;

            case 'spacer':
                return <SpacerProperties props={props} onPropsChange={handlePropsUpdate} />;

            case 'social':
                return <SocialProperties props={props} onPropsChange={handlePropsUpdate} />;

            case 'divider':
                return (
                    <p style={{ textAlign: 'center', fontSize: '13px', color: '#6c757d' }}>
                        Este bloco não possui propriedades de conteúdo.
                    </p>
                );

            default:
                return null;
        }
    };

    const renderStyleFields = () => {
        if (block.type === 'divider') {
            return (
                <>
                    <StyleSection>
                        <StyleSectionTitle>
                            <Palette size={16} />
                            Estilo da Linha
                        </StyleSectionTitle>
                        <StyleGrid>
                            <StyleRow>
                                <Label>Cor da Linha</Label>
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                    <ColorPicker
                                        type="color"
                                        value={style.borderColor || '#e0e0e0'}
                                        onChange={(e) => handleStyleChange('borderColor', e.target.value)}
                                        aria-label="Selecionar cor da linha"
                                    />
                                    <span style={{ fontSize: '12px', color: '#666' }}>
                                        {style.borderColor || '#e0e0e0'}
                                    </span>
                                </div>
                            </StyleRow>
                            <StyleRow>
                                <Label>Espessura</Label>
                                <Select
                                    value={style.borderWidth || '1px'}
                                    onChange={(e) => handleStyleChange('borderWidth', e.target.value)}
                                    aria-label="Selecionar espessura da linha"
                                >
                                    <option value="1px">Fina (1px)</option>
                                    <option value="2px">Média (2px)</option>
                                    <option value="3px">Grossa (3px)</option>
                                    <option value="4px">Extra Grossa (4px)</option>
                                </Select>
                            </StyleRow>
                        </StyleGrid>
                    </StyleSection>
                    <StyleSection>
                        <StyleSectionTitle><Ruler size={16} /> Espaçamento</StyleSectionTitle>
                        <SpacingControl style={style} onChange={handleSpacingChange} />
                    </StyleSection>
                </>
            );
        }

        const hasNoTextStyles = ['text', 'heading', 'social', 'spacer'].includes(block.type);
        const isImageBlock = block.type === 'image';

        return (
            <>
                {block.type === 'social' && (
                    <StyleSection>
                        <StyleSectionTitle>
                            <PaintBrush size={16} />
                            Estilo dos Ícones
                        </StyleSectionTitle>
                        <StyleGrid>
                            <StyleRow>
                                <Label>Cor dos Ícones</Label>
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                    <ColorPicker
                                        type="color"
                                        value={style.iconColor || globalSettings.textColor || '#333333'}
                                        onChange={(e) => handleStyleChange('iconColor', e.target.value)}
                                        aria-label="Selecionar cor dos ícones"
                                    />
                                    <span style={{ fontSize: '12px', color: '#666' }}>
                                        {style.iconColor || globalSettings.textColor || '#333333'}
                                    </span>
                                </div>
                            </StyleRow>
                            <StyleRow>
                                <Label>Tamanho</Label>
                                <Select
                                    value={style.iconSize || '24px'}
                                    onChange={(e) => handleStyleChange('iconSize', e.target.value)}
                                    aria-label="Selecionar tamanho dos ícones"
                                >
                                    <option value="16px">Pequeno (16px)</option>
                                    <option value="24px">Médio (24px)</option>
                                    <option value="32px">Grande (32px)</option>
                                    <option value="40px">Extra Grande (40px)</option>
                                </Select>
                            </StyleRow>
                        </StyleGrid>
                        <StyleRow style={{ marginTop: '12px' }}>
                            <Label>Alinhamento</Label>
                            <AlignmentButtons role="group" aria-label="Alinhamento dos ícones">
                                <AlignButton
                                    type="button"
                                    $isActive={(style.textAlign || 'center') === 'left'}
                                    onClick={() => handleStyleChange('textAlign', 'left')}
                                    aria-label="Alinhar à esquerda"
                                    title="Alinhar à esquerda"
                                >
                                    <TextAlignLeft size={16} />
                                </AlignButton>
                                <AlignButton
                                    type="button"
                                    $isActive={(style.textAlign || 'center') === 'center'}
                                    onClick={() => handleStyleChange('textAlign', 'center')}
                                    aria-label="Centralizar"
                                    title="Centralizar"
                                >
                                    <TextAlignCenter size={16} />
                                </AlignButton>
                                <AlignButton
                                    type="button"
                                    $isActive={(style.textAlign || 'center') === 'right'}
                                    onClick={() => handleStyleChange('textAlign', 'right')}
                                    aria-label="Alinhar à direita"
                                    title="Alinhar à direita"
                                >
                                    <TextAlignRight size={16} />
                                </AlignButton>
                            </AlignmentButtons>
                        </StyleRow>
                    </StyleSection>
                )}

                <StyleSection>
                    <StyleSectionTitle>
                        <Palette size={16} />
                        Estilo do Bloco
                    </StyleSectionTitle>
                    <StyleGrid>
                        {!hasNoTextStyles && (
                            <StyleRow>
                                <Label>Cor do Texto</Label>
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                    <ColorPicker
                                        type="color"
                                        value={style.textColor || globalSettings.textColor || '#333333'}
                                        onChange={(e) => handleStyleChange('textColor', e.target.value)}
                                        aria-label="Selecionar cor do texto"
                                    />
                                    <span style={{ fontSize: '12px', color: '#666' }}>
                                        {style.textColor || globalSettings.textColor || '#333333'}
                                    </span>
                                </div>
                            </StyleRow>
                        )}
                        <StyleRow>
                            <Label>Cor de Fundo</Label>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <ColorPicker
                                    type="color"
                                    value={style.backgroundColor || 'transparent'}
                                    onChange={(e) => handleStyleChange('backgroundColor', e.target.value)}
                                    aria-label="Selecionar cor de fundo"
                                />
                                <span style={{ fontSize: '12px', color: '#666' }}>
                                    {style.backgroundColor || 'Transparente'}
                                </span>
                            </div>
                        </StyleRow>
                    </StyleGrid>
                </StyleSection>

                {!hasNoTextStyles && (
                    <StyleSection>
                        <StyleSectionTitle>
                            <TextT size={16} />
                            {isImageBlock ? 'Alinhamento' : 'Tipografia'}
                        </StyleSectionTitle>
                        {!isImageBlock && (
                            <StyleGrid>
                                <StyleRow>
                                    <Label>Fonte</Label>
                                    <Select
                                        value={style.fontFamily || globalSettings.fontFamily || 'Arial, sans-serif'}
                                        onChange={(e) => handleStyleChange('fontFamily', e.target.value)}
                                        aria-label="Selecionar fonte"
                                    >
                                        {FONT_FAMILY_GROUPS.map((group) => (
                                            <optgroup key={group.group} label={group.group}>
                                                {group.fonts.map((font) => (
                                                    <option key={font.value} value={font.value}>
                                                        {font.label}
                                                    </option>
                                                ))}
                                            </optgroup>
                                        ))}
                                    </Select>
                                </StyleRow>
                                <StyleRow>
                                    <Label>Tamanho</Label>
                                    <Select
                                        value={style.fontSize || '16px'}
                                        onChange={(e) => handleStyleChange('fontSize', e.target.value)}
                                        aria-label="Selecionar tamanho da fonte"
                                    >
                                        {FONT_SIZES.map((size) => (
                                            <option key={size.value} value={size.value}>
                                                {size.label}
                                            </option>
                                        ))}
                                    </Select>
                                </StyleRow>
                            </StyleGrid>
                        )}
                        <StyleRow style={{ marginTop: isImageBlock ? 0 : '12px' }}>
                            <Label>Alinhamento</Label>
                            <AlignmentButtons role="group" aria-label="Alinhamento do texto">
                                <AlignButton
                                    type="button"
                                    $isActive={(style.textAlign || 'left') === 'left'}
                                    onClick={() => handleStyleChange('textAlign', 'left')}
                                    aria-label="Alinhar à esquerda"
                                    title="Alinhar à esquerda"
                                >
                                    <TextAlignLeft size={16} />
                                </AlignButton>
                                <AlignButton
                                    type="button"
                                    $isActive={(style.textAlign || 'left') === 'center'}
                                    onClick={() => handleStyleChange('textAlign', 'center')}
                                    aria-label="Centralizar"
                                    title="Centralizar"
                                >
                                    <TextAlignCenter size={16} />
                                </AlignButton>
                                <AlignButton
                                    type="button"
                                    $isActive={(style.textAlign || 'left') === 'right'}
                                    onClick={() => handleStyleChange('textAlign', 'right')}
                                    aria-label="Alinhar à direita"
                                    title="Alinhar à direita"
                                >
                                    <TextAlignRight size={16} />
                                </AlignButton>
                                <AlignButton
                                    type="button"
                                    $isActive={(style.textAlign || 'left') === 'justify'}
                                    onClick={() => handleStyleChange('textAlign', 'justify')}
                                    aria-label="Justificar"
                                    title="Justificar"
                                >
                                    <TextAlignJustify size={16} />
                                </AlignButton>
                            </AlignmentButtons>
                        </StyleRow>
                    </StyleSection>
                )}

                <StyleSection>
                    <StyleSectionTitle>📏 Espaçamento</StyleSectionTitle>
                    <SpacingControl style={style} onChange={handleSpacingChange} />
                </StyleSection>

                <StyleSection>
                    <StyleSectionTitle><FrameCorners size={16} /> Bordas</StyleSectionTitle>
                    <StyleGrid>
                        <StyleRow>
                            <Label>Cor da Borda</Label>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <ColorPicker
                                    type="color"
                                    value={style.borderColor || '#e0e0e0'}
                                    onChange={(e) => handleStyleChange('borderColor', e.target.value)}
                                    aria-label="Selecionar cor da borda"
                                />
                                <span style={{ fontSize: '12px', color: '#666' }}>
                                    {style.borderColor || '#e0e0e0'}
                                </span>
                            </div>
                        </StyleRow>
                        <StyleRow>
                            <Label>Espessura</Label>
                            <Select
                                value={style.borderWidth || '0px'}
                                onChange={(e) => handleStyleChange('borderWidth', e.target.value)}
                                aria-label="Selecionar espessura da borda"
                            >
                                <option value="0px">Sem borda</option>
                                <option value="1px">1px</option>
                                <option value="2px">2px</option>
                                <option value="3px">3px</option>
                                <option value="4px">4px</option>
                            </Select>
                        </StyleRow>
                    </StyleGrid>
                    <StyleRow style={{ marginTop: '12px' }}>
                        <Label>Raio da Borda</Label>
                        <Select
                            value={style.borderRadius || '0px'}
                            onChange={(e) => handleStyleChange('borderRadius', e.target.value)}
                            aria-label="Selecionar raio da borda"
                        >
                            <option value="0px">Sem raio</option>
                            <option value="4px">Pequeno (4px)</option>
                            <option value="6px">Médio (6px)</option>
                            <option value="8px">Grande (8px)</option>
                            <option value="12px">Extra Grande (12px)</option>
                            <option value="50%">Circular</option>
                        </Select>
                    </StyleRow>
                </StyleSection>
            </>
        );
    };

    const BlockIcon = BLOCK_ICONS[block.type] || TextT;

    return (
        <div>
            <PanelHeader>
                <PanelHeaderIcon>
                    <BlockIcon size={18} weight="bold" />
                </PanelHeaderIcon>
                <PanelTitle>{BLOCK_LABELS[block.type] || 'Bloco'}</PanelTitle>
                <CloseIconButton
                    type="button"
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onClose();
                    }}
                    aria-label="Fechar painel de propriedades"
                    title="Fechar"
                >
                    <X size={18} />
                </CloseIconButton>
            </PanelHeader>

            {renderPropsFields()}
            {renderStyleFields()}

            <AutoSaveNote>
                <CheckCircle size={14} weight="fill" />
                Alterações salvas automaticamente
            </AutoSaveNote>
        </div>
    );
};