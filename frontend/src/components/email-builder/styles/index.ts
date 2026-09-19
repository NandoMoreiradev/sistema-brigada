import styled from 'styled-components';
import type { GlobalEmailSettings } from '../types';
import { tokens } from './tokens';

// =============================================================================
// LAYOUT PRINCIPAL
// =============================================================================

export const EditorWrapper = styled.div`
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
    background-color: ${tokens.color.canvas};
    overflow: hidden;
`;

// -----------------------------------------------------------------------------
// BARRA DE TOPO UNIFICADA
// -----------------------------------------------------------------------------

export const TopBar = styled.header`
    display: flex;
    align-items: center;
    gap: ${tokens.space.md};
    height: 60px;
    padding: 0 ${tokens.space.lg};
    background-color: ${tokens.color.surface};
    border-bottom: 1px solid ${tokens.color.line};
    flex-shrink: 0;
`;

export const TopBarGroup = styled.div`
    display: flex;
    align-items: center;
    gap: ${tokens.space.sm};

    &.center {
        margin: 0 auto;
    }
    &.right {
        margin-left: auto;
    }
`;

export const TopBarDivider = styled.div`
    width: 1px;
    height: 24px;
    background-color: ${tokens.color.line};
    flex-shrink: 0;
`;

export const BackButton = styled.button`
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 36px;
    padding: 0 12px;
    background: transparent;
    border: 1px solid transparent;
    border-radius: ${tokens.radius.md};
    color: ${tokens.color.muted};
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;

    &:hover {
        background: ${tokens.color.surfaceAlt};
        color: ${tokens.color.ink};
    }
`;

export const TemplateNameInput = styled.input`
    height: 36px;
    min-width: 160px;
    max-width: 320px;
    padding: 0 10px;
    border: 1px solid transparent;
    border-radius: ${tokens.radius.md};
    font-size: 15px;
    font-weight: 600;
    color: ${tokens.color.ink};
    background: transparent;
    transition: all 0.15s ease;

    &::placeholder {
        color: ${tokens.color.faint};
        font-weight: 500;
    }

    &:hover {
        background: ${tokens.color.surfaceAlt};
    }

    &:focus {
        outline: none;
        background: ${tokens.color.surface};
        border-color: ${tokens.color.accent};
        box-shadow: ${tokens.shadow.focus};
    }

    &.has-error {
        border-color: ${tokens.color.danger};
    }
`;

// Grupo de botões segmentado (ex.: desktop/mobile)
export const SegmentGroup = styled.div`
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 3px;
    background: ${tokens.color.surfaceAlt};
    border: 1px solid ${tokens.color.line};
    border-radius: ${tokens.radius.md};
`;

export const SegmentButton = styled.button<{ $active?: boolean }>`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    height: 30px;
    min-width: 34px;
    padding: 0 8px;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 13px;
    font-weight: 600;
    color: ${({ $active }) => ($active ? tokens.color.accent : tokens.color.muted)};
    background: ${({ $active }) => ($active ? tokens.color.surface : 'transparent')};
    box-shadow: ${({ $active }) => ($active ? tokens.shadow.xs : 'none')};
    transition: all 0.15s ease;

    &:hover:not(:disabled) {
        color: ${tokens.color.ink};
    }

    &:disabled {
        opacity: 0.4;
        cursor: not-allowed;
    }
`;

// Botão só de ícone (undo/redo, engrenagem)
export const IconButton = styled.button`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border: 1px solid ${tokens.color.line};
    border-radius: ${tokens.radius.md};
    background: ${tokens.color.surface};
    color: ${tokens.color.muted};
    cursor: pointer;
    position: relative;
    transition: all 0.15s ease;

    &:hover:not(:disabled) {
        background: ${tokens.color.surfaceAlt};
        color: ${tokens.color.ink};
        border-color: ${tokens.color.line};
    }

    &:disabled {
        opacity: 0.4;
        cursor: not-allowed;
    }
`;

// Ponto de alerta (ex.: campos obrigatórios pendentes no popover)
export const AlertDot = styled.span`
    position: absolute;
    top: -3px;
    right: -3px;
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: ${tokens.color.danger};
    border: 2px solid ${tokens.color.surface};
`;

export const GhostButton = styled.button`
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 36px;
    padding: 0 14px;
    border: 1px solid ${tokens.color.line};
    border-radius: ${tokens.radius.md};
    background: ${tokens.color.surface};
    color: ${tokens.color.text};
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;

    &:hover:not(:disabled) {
        background: ${tokens.color.surfaceAlt};
        border-color: ${tokens.color.faint};
    }

    &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
`;

export const PrimaryButton = styled.button`
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 36px;
    padding: 0 18px;
    border: none;
    border-radius: ${tokens.radius.md};
    background: ${tokens.color.accent};
    color: #fff;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    box-shadow: ${tokens.shadow.xs};
    transition: all 0.15s ease;

    &:hover:not(:disabled) {
        background: ${tokens.color.accentHover};
    }

    &:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }
`;

// -----------------------------------------------------------------------------
// LEGADO (mantidos para compatibilidade de imports)
// -----------------------------------------------------------------------------

export const EditorHeader = styled.header`
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1.5rem;
    background-color: ${tokens.color.surface};
    border-bottom: 1px solid ${tokens.color.line};
    flex-shrink: 0;
`;

export const EditorTitle = styled.h2`
    font-size: 1.1rem;
    font-weight: 700;
    margin: 0;
    color: ${tokens.color.ink};
`;

export const EditorActions = styled.div`
    display: flex;
    align-items: center;
    gap: 1rem;
`;

// =============================================================================
// CONTEÚDO (3 COLUNAS)
// =============================================================================

export const EditorContent = styled.main`
    display: flex;
    flex-grow: 1;
    overflow: hidden;
`;

const scrollbar = `
    &::-webkit-scrollbar { width: 8px; }
    &::-webkit-scrollbar-track { background: transparent; }
    &::-webkit-scrollbar-thumb {
        background: ${tokens.color.line};
        border-radius: 999px;
        border: 2px solid transparent;
        background-clip: padding-box;
    }
    &::-webkit-scrollbar-thumb:hover { background: ${tokens.color.faint}; background-clip: padding-box; }
`;

export const LeftSidebar = styled.aside`
    width: 300px;
    background-color: ${tokens.color.surface};
    border-right: 1px solid ${tokens.color.line};
    display: flex;
    flex-direction: column;
    overflow: hidden;
    flex-shrink: 0;
`;

export const MainCanvas = styled.section<{ $previewMode: 'desktop' | 'mobile' }>`
    flex-grow: 1;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding: 2.5rem 2rem;
    background-color: ${tokens.color.canvas};
    background-image: radial-gradient(${tokens.color.line} 1px, transparent 1px);
    background-size: 22px 22px;
    overflow: auto;
    ${scrollbar}
`;

export const EmailPreview = styled.div<{ $previewMode: 'desktop' | 'mobile'; $globalSettings: GlobalEmailSettings }>`
    width: 100%;
    max-width: ${({ $previewMode, $globalSettings }) =>
        $previewMode === 'mobile' ? '375px' : ($globalSettings.maxWidth || '600px')};
    background-color: ${({ $globalSettings }) => $globalSettings.backgroundColor || '#ffffff'};
    border: 1px solid ${tokens.color.line};
    border-radius: ${tokens.radius.lg};
    box-shadow: ${tokens.shadow.lg};
    min-height: 460px;
    padding: 24px;
    transition: max-width 0.3s ease-in-out;
    position: relative;
    font-family: ${({ $globalSettings }) => $globalSettings.fontFamily || 'inherit'};
    color: ${({ $globalSettings }) => $globalSettings.textColor || tokens.color.text};
`;

export const EmptyState = styled.div<{ $isDragging: boolean }>`
    text-align: center;
    padding: 64px 24px;
    color: ${tokens.color.muted};
    border: 2px dashed ${({ $isDragging }) => ($isDragging ? tokens.color.accent : tokens.color.line)};
    border-radius: ${tokens.radius.lg};
    background: ${({ $isDragging }) => ($isDragging ? tokens.color.accentSoft : tokens.color.surfaceAlt)};
    transition: all 0.2s ease;

    h3 {
        margin: 0 0 6px;
        font-size: 16px;
        font-weight: 700;
        color: ${tokens.color.ink};
    }
    p {
        margin: 0;
        font-size: 13px;
    }
`;

// =============================================================================
// BLOCO NO CANVAS
// =============================================================================

function resolveBlockPadding(s: any): string {
    if (!s) return '8px';
    const hasPerSide = s.paddingTop !== undefined || s.paddingRight !== undefined
        || s.paddingBottom !== undefined || s.paddingLeft !== undefined;
    if (hasPerSide) {
        const t = s.paddingTop ?? 8;
        const r = s.paddingRight ?? 8;
        const b = s.paddingBottom ?? 8;
        const l = s.paddingLeft ?? 8;
        return `${t}px ${r}px ${b}px ${l}px`;
    }
    return s.padding || '8px';
}

function resolveBlockMargin(s: any): string {
    if (!s) return '16px 0';
    const hasPerSide = s.marginTop !== undefined || s.marginBottom !== undefined;
    if (hasPerSide) {
        const t = s.marginTop ?? 16;
        const b = s.marginBottom ?? 16;
        return `${t}px 0 ${b}px 0`;
    }
    return s.margin || '16px 0';
}

export const BlockContainer = styled.div<{ $isSelected: boolean; $blockStyle?: any }>`
    margin: ${({ $blockStyle }) => resolveBlockMargin($blockStyle)};
    position: relative;
    padding: ${({ $blockStyle }) => resolveBlockPadding($blockStyle)};
    border-radius: ${({ $blockStyle }) => $blockStyle?.borderRadius || tokens.radius.sm};
    border: 2px solid ${({ $isSelected, $blockStyle }) =>
        $isSelected ? tokens.color.accent :
            $blockStyle?.borderColor ? $blockStyle.borderColor : 'transparent'};
    background-color: ${({ $isSelected, $blockStyle }) =>
        $blockStyle?.backgroundColor ||
        ($isSelected ? tokens.color.accentSoft : 'transparent')};
    box-shadow: ${({ $isSelected }) => ($isSelected ? tokens.shadow.focus : 'none')};
    transition: border-color 0.15s ease, box-shadow 0.15s ease, background-color 0.15s ease;
    cursor: pointer;

    &:hover {
        border-color: ${({ $isSelected }) => ($isSelected ? tokens.color.accent : tokens.color.accentBorder)};
    }
`;

// =============================================================================
// SIDEBAR DIREITA
// =============================================================================

export const RightSidebar = styled.aside`
    width: 344px;
    background-color: ${tokens.color.surface};
    border-left: 1px solid ${tokens.color.line};
    display: flex;
    flex-direction: column;
    overflow: hidden;
    flex-shrink: 0;
`;

// =============================================================================
// TABS
// =============================================================================

export const TabContainer = styled.div`
    display: flex;
    padding: 6px;
    gap: 4px;
    border-bottom: 1px solid ${tokens.color.line};
    flex-shrink: 0;
`;

export const TabButton = styled.button<{ $isActive: boolean }>`
    all: unset;
    box-sizing: border-box;
    flex-grow: 1;
    text-align: center;
    padding: 8px 4px;
    border-radius: ${tokens.radius.md};
    cursor: pointer;
    color: ${({ $isActive }) => ($isActive ? tokens.color.accent : tokens.color.muted)};
    background-color: ${({ $isActive }) => ($isActive ? tokens.color.accentSoft : 'transparent')};
    transition: all 0.15s ease;
    font-size: 13px;
    font-weight: 600;
    display: flex;
    align-items: center;
    justify-content: center;

    &:hover {
        background-color: ${({ $isActive }) => ($isActive ? tokens.color.accentSoft : tokens.color.surfaceAlt)};
        color: ${({ $isActive }) => ($isActive ? tokens.color.accent : tokens.color.ink)};
    }

    &:disabled {
        color: ${tokens.color.faint};
        cursor: not-allowed;
        background-color: transparent;
    }
`;

export const TabContent = styled.div`
    padding: ${tokens.space.lg};
    overflow-y: auto;
    flex-grow: 1;
    ${scrollbar}
`;

// =============================================================================
// SEÇÕES DE ESTILO (painel de propriedades)
// =============================================================================

export const StyleSection = styled.div`
    border: 1px solid ${tokens.color.line};
    border-radius: ${tokens.radius.lg};
    padding: 14px;
    margin-bottom: 14px;
    background-color: ${tokens.color.surface};
`;

export const StyleSectionTitle = styled.h4`
    margin: 0 0 12px 0;
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    color: ${tokens.color.muted};
    display: flex;
    align-items: center;
    gap: 8px;

    svg { color: ${tokens.color.faint}; }
`;

export const StyleGrid = styled.div`
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
`;

export const StyleRow = styled.div`
    display: flex;
    flex-direction: column;
    gap: 6px;
`;

export const ColorPicker = styled.input`
    width: 34px;
    height: 34px;
    border: 1px solid ${tokens.color.line};
    border-radius: ${tokens.radius.md};
    cursor: pointer;
    padding: 2px;
    background: ${tokens.color.surface};

    &::-webkit-color-swatch-wrapper { padding: 0; }
    &::-webkit-color-swatch { border: none; border-radius: 5px; }
`;

export const Select = styled.select`
    width: 100%;
    box-sizing: border-box;
    padding: 8px 10px;
    border: 1px solid ${tokens.color.line};
    border-radius: ${tokens.radius.md};
    font-size: 13px;
    color: ${tokens.color.text};
    background-color: ${tokens.color.surface};
    line-height: 1.2;
    cursor: pointer;
    transition: all 0.15s ease;

    &:focus {
        outline: none;
        border-color: ${tokens.color.accent};
        box-shadow: ${tokens.shadow.focus};
    }
`;

export const AlignmentButtons = styled.div`
    display: flex;
    border: 1px solid ${tokens.color.line};
    border-radius: ${tokens.radius.md};
    overflow: hidden;
`;

export const AlignButton = styled.button<{ $isActive: boolean }>`
    all: unset;
    box-sizing: border-box;
    padding: 7px 8px;
    cursor: pointer;
    background-color: ${({ $isActive }) => ($isActive ? tokens.color.accent : tokens.color.surface)};
    color: ${({ $isActive }) => ($isActive ? '#fff' : tokens.color.muted)};
    display: flex;
    align-items: center;
    justify-content: center;
    flex-grow: 1;
    transition: all 0.15s ease;

    &:hover {
        background-color: ${({ $isActive }) => ($isActive ? tokens.color.accentHover : tokens.color.surfaceAlt)};
    }
`;

export const Label = styled.label`
    font-size: 11px;
    font-weight: 600;
    color: ${tokens.color.muted};
    margin-bottom: 2px;
`;

export const PlaceholderText = styled.div`
    text-align: center;
    color: ${tokens.color.faint};
    margin-top: 20px;
    width: 100%;
    font-size: 13px;
`;

// =============================================================================
// PALETA DE COMPONENTES (card em grid)
// =============================================================================

export const PaletteItemStyled = styled.div<{ $isDragging: boolean }>`
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 14px 8px;
    border: 1px solid ${({ $isDragging }) => ($isDragging ? tokens.color.accent : tokens.color.line)};
    background-color: ${({ $isDragging }) => ($isDragging ? tokens.color.accentSoft : tokens.color.surface)};
    border-radius: ${tokens.radius.lg};
    cursor: grab;
    color: ${tokens.color.text};
    user-select: none;
    font-size: 12px;
    font-weight: 600;
    text-align: center;
    transition: all 0.15s ease;

    svg { color: ${tokens.color.muted}; transition: color 0.15s ease; }

    &:hover {
        background-color: ${tokens.color.accentSoft};
        border-color: ${tokens.color.accentBorder};
        color: ${tokens.color.accent};
        transform: translateY(-1px);
        box-shadow: ${tokens.shadow.sm};

        svg { color: ${tokens.color.accent}; }
    }

    &:active {
        cursor: grabbing;
        transform: translateY(0);
    }
`;

export const PaletteGrid = styled.div`
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
`;

// =============================================================================
// DROP ZONE
// =============================================================================

export const DropZone = styled.div<{ $isOver: boolean; $isDragging: boolean; $isEmpty: boolean }>`
    height: ${({ $isDragging, $isEmpty }) => {
        if ($isEmpty && $isDragging) return '80px';
        if ($isDragging) return '44px';
        return '4px';
    }};
    background-color: ${({ $isOver }) => ($isOver ? tokens.color.accentSoft : 'transparent')};
    transition: all 0.15s ease-in-out;
    position: relative;
    margin: 6px 0;
    border: ${({ $isOver, $isDragging }) => {
        if ($isOver) return `2px dashed ${tokens.color.accent}`;
        if ($isDragging) return `2px dashed ${tokens.color.line}`;
        return '2px dashed transparent';
    }};
    border-radius: ${tokens.radius.md};
    display: flex;
    align-items: center;
    justify-content: center;

    &::before {
        content: ${({ $isOver }) => ($isOver ? '"Solte aqui"' : '""')};
        font-size: 12px;
        font-weight: 600;
        color: ${tokens.color.accent};
    }
`;

// =============================================================================
// AUXILIARES (listas, colunas, tabelas em painéis)
// =============================================================================

export const ListItemContainer = styled.div`
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 6px;
    padding: 6px;
    border: 1px solid ${tokens.color.line};
    border-radius: ${tokens.radius.md};
`;

export const ColumnContainer = styled.div`
    display: flex;
    gap: 6px;
    margin-bottom: 6px;
    padding: 6px;
    border: 1px solid ${tokens.color.line};
    border-radius: ${tokens.radius.md};
`;

export const TableContainer = styled.div`
    overflow-x: auto;
    margin: 6px 0;
`;

export const SmallButton = styled.button`
    all: unset;
    box-sizing: border-box;
    padding: 5px 8px;
    background-color: ${tokens.color.surfaceAlt};
    border: 1px solid ${tokens.color.line};
    border-radius: ${tokens.radius.sm};
    cursor: pointer;
    font-size: 11px;
    font-weight: 600;
    color: ${tokens.color.muted};
    display: flex;
    align-items: center;
    gap: 3px;
    line-height: 1;
    transition: all 0.15s ease;

    &:hover {
        background-color: ${tokens.color.lineSoft};
        color: ${tokens.color.ink};
    }
`;
