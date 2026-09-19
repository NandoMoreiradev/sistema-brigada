// frontend/src/components/email-builder/emailBuilderReducer.ts

import type {
    ExtendedBlock,
    GlobalEmailSettings,
    ExtendedBlockProps,
    BlockStyle,
    BlockType
} from './types';
import { arrayMove } from '@dnd-kit/sortable';
import { sanitizeUrl, sanitizeText } from '@/utils/sanitize';

// 1. DEFINIÇÃO DO ESTADO
export interface EmailBuilderState {
    blocks: ExtendedBlock[];
    selectedBlockIds: string[];
    globalSettings: GlobalEmailSettings;
    history: ExtendedBlock[][];
    historyIndex: number;
}

// 2. DEFINIÇÃO DAS AÇÕES
type ActionMap<M extends { [index: string]: any }> = {
    [Key in keyof M]: M[Key] extends undefined
        ? {
            type: Key;
        }
        : {
            type: Key;
            payload: M[Key];
        };
};

// `erasableSyntaxOnly` (tsconfig) proíbe `enum` (não é sintaxe puramente
// apagável) — mesmo efeito com um objeto `as const` + tipo derivado.
export const ActionTypes = {
    SET_BLOCKS: 'SET_BLOCKS',
    ADD_BLOCK: 'ADD_BLOCK',
    DELETE_BLOCK: 'DELETE_BLOCK',
    DUPLICATE_BLOCK: 'DUPLICATE_BLOCK',
    MOVE_BLOCK: 'MOVE_BLOCK',
    UPDATE_BLOCK_PROPS: 'UPDATE_BLOCK_PROPS',
    UPDATE_BLOCK_STYLE: 'UPDATE_BLOCK_STYLE',
    UPDATE_FULL_BLOCK: 'UPDATE_FULL_BLOCK',
    SELECT_BLOCK: 'SELECT_BLOCK',
    DESELECT_ALL: 'DESELECT_ALL',
    UPDATE_GLOBAL_SETTINGS: 'UPDATE_GLOBAL_SETTINGS',
    SET_INITIAL_STATE: 'SET_INITIAL_STATE',
    UNDO: 'UNDO',
    REDO: 'REDO',
} as const;
export type ActionTypes = (typeof ActionTypes)[keyof typeof ActionTypes];

type ActionPayload = {
    SET_BLOCKS: { blocks: ExtendedBlock[] };
    ADD_BLOCK: { block: ExtendedBlock; index: number };
    DELETE_BLOCK: { blockId: string };
    DUPLICATE_BLOCK: { blockId: string };
    MOVE_BLOCK: { oldIndex: number; newIndex: number };
    UPDATE_BLOCK_PROPS: { blockId: string; props: ExtendedBlockProps };
    UPDATE_BLOCK_STYLE: { blockId: string; style: BlockStyle };
    UPDATE_FULL_BLOCK: { blockId: string; props: ExtendedBlockProps; style: BlockStyle };
    SELECT_BLOCK: { blockId: string; isMultiSelect: boolean };
    DESELECT_ALL: undefined;
    UPDATE_GLOBAL_SETTINGS: { settings: Partial<GlobalEmailSettings> };
    SET_INITIAL_STATE: { blocks: ExtendedBlock[]; settings: GlobalEmailSettings };
    UNDO: undefined;
    REDO: undefined;
};

export type EmailBuilderActions = ActionMap<ActionPayload>[keyof ActionMap<ActionPayload>];

const sanitizeBlockProps = (props: ExtendedBlockProps): ExtendedBlockProps => {
    const sanitized = { ...props };

    // Sanitiza textos
    if (sanitized.children && typeof sanitized.children === 'string') {
        sanitized.children = sanitizeText(sanitized.children);
    }

    // ✅ VALIDAÇÃO ROBUSTA (CORRIGIDA PARA MERGE TAGS)
    if (sanitized.href) {
        // Se contiver {{ e }}, assumimos que é uma merge tag e ignoramos a sanitização de URL estrita
        if (sanitized.href.includes('{{') && sanitized.href.includes('}}')) {
            // Mantém como está, pois será processado no backend
        } else {
            const sanitizedUrl = sanitizeUrl(sanitized.href);
            sanitized.href = sanitizedUrl || 'https://example.com'; // Fallback seguro
        }
    }

    if (sanitized.src) {
        // Imagens também podem vir de variáveis dinâmicas (ex: avatar do usuário)
        if (sanitized.src.includes('{{') && sanitized.src.includes('}}')) {
            // Mantém
        } else {
            const sanitizedSrc = sanitizeUrl(sanitized.src);
            sanitized.src = sanitizedSrc || 'https://placehold.co/600x200';
        }
    }

    // Sanitiza arrays (colunas, itens de lista, etc) - Mantido igual
    if (sanitized.columns) {
        sanitized.columns = sanitized.columns.map(col => ({
            ...col,
            content: sanitizeText(col.content)
        }));
    }

    if (sanitized.items) {
        sanitized.items = sanitized.items.map(item => ({
            ...item,
            text: sanitizeText(item.text)
        }));
    }

    if (sanitized.tableHeaders) {
        sanitized.tableHeaders = sanitized.tableHeaders.map(sanitizeText);
    }

    if (sanitized.tableRows) {
        sanitized.tableRows = sanitized.tableRows.map(row => ({
            ...row,
            cells: row.cells.map(sanitizeText)
        }));
    }

    return sanitized;
};

// Função auxiliar para registrar o histórico
const withHistory = (newState: EmailBuilderState, oldBlocks: ExtendedBlock[]): EmailBuilderState => {
    if (JSON.stringify(newState.blocks) === JSON.stringify(oldBlocks)) {
        return newState;
    }
    const newHistory = [...newState.history.slice(0, newState.historyIndex + 1), newState.blocks];

    // ✅ OTIMIZAÇÃO: Limita histórico a 50 estados
    const MAX_HISTORY = 50;
    const trimmedHistory = newHistory.length > MAX_HISTORY
        ? newHistory.slice(newHistory.length - MAX_HISTORY)
        : newHistory;

    return {
        ...newState,
        history: trimmedHistory,
        historyIndex: trimmedHistory.length - 1,
    };
};

// 3. O REDUCER
export const emailBuilderReducer = (state: EmailBuilderState, action: EmailBuilderActions): EmailBuilderState => {
    switch (action.type) {
        case ActionTypes.ADD_BLOCK: {
            // ✅ SANITIZAÇÃO: Sanitiza props antes de adicionar
            const sanitizedBlock = {
                ...action.payload.block,
                props: sanitizeBlockProps(action.payload.block.props)
            };

            const newBlocks = [...state.blocks];
            newBlocks.splice(action.payload.index, 0, sanitizedBlock);
            const newState: EmailBuilderState = {
                ...state,
                blocks: newBlocks,
                selectedBlockIds: [sanitizedBlock.id]
            };
            return withHistory(newState, state.blocks);
        }

        case ActionTypes.DELETE_BLOCK: {
            const newBlocks = state.blocks.filter(b => b.id !== action.payload.blockId);
            const newState: EmailBuilderState = {
                ...state,
                blocks: newBlocks,
                selectedBlockIds: state.selectedBlockIds.filter(id => id !== action.payload.blockId)
            };
            return withHistory(newState, state.blocks);
        }

        case ActionTypes.DUPLICATE_BLOCK: {
            const blockToDuplicate = state.blocks.find(b => b.id === action.payload.blockId);
            if (!blockToDuplicate) return state;

            const index = state.blocks.findIndex(b => b.id === action.payload.blockId);
            const newBlock: ExtendedBlock = {
                ...blockToDuplicate,
                id: `block-${crypto.randomUUID()}`,
                props: sanitizeBlockProps(blockToDuplicate.props) // ✅ SANITIZAÇÃO
            };

            const newBlocks = [...state.blocks];
            newBlocks.splice(index + 1, 0, newBlock);

            const newState: EmailBuilderState = { ...state, blocks: newBlocks };
            return withHistory(newState, state.blocks);
        }

        case ActionTypes.MOVE_BLOCK: {
            const newBlocks = arrayMove(state.blocks, action.payload.oldIndex, action.payload.newIndex);
            const newState: EmailBuilderState = { ...state, blocks: newBlocks };
            return withHistory(newState, state.blocks);
        }

        case ActionTypes.UPDATE_BLOCK_PROPS: {
            // ✅ SANITIZAÇÃO: Sanitiza props antes de atualizar
            const sanitizedProps = sanitizeBlockProps(action.payload.props);

            const newBlocks = state.blocks.map(b =>
                b.id === action.payload.blockId ? { ...b, props: sanitizedProps } : b
            );
            const newState: EmailBuilderState = { ...state, blocks: newBlocks };
            return withHistory(newState, state.blocks);
        }

        case ActionTypes.UPDATE_FULL_BLOCK: {
            // ✅ SANITIZAÇÃO
            const sanitizedProps = sanitizeBlockProps(action.payload.props);

            const newBlocks = state.blocks.map(b =>
                b.id === action.payload.blockId
                    ? { ...b, props: sanitizedProps, style: action.payload.style }
                    : b
            );
            const newState: EmailBuilderState = { ...state, blocks: newBlocks };
            return withHistory(newState, state.blocks);
        }

        case ActionTypes.SELECT_BLOCK: {
            if (action.payload.isMultiSelect) {
                const newIds = new Set(state.selectedBlockIds);
                if (newIds.has(action.payload.blockId)) {
                    newIds.delete(action.payload.blockId);
                } else {
                    newIds.add(action.payload.blockId);
                }
                return { ...state, selectedBlockIds: Array.from(newIds) };
            }
            return { ...state, selectedBlockIds: [action.payload.blockId] };
        }

        case ActionTypes.DESELECT_ALL:
            return { ...state, selectedBlockIds: [] };

        case ActionTypes.UPDATE_GLOBAL_SETTINGS:
            return { ...state, globalSettings: { ...state.globalSettings, ...action.payload.settings } };

        case ActionTypes.SET_INITIAL_STATE:
            return {
                ...state,
                blocks: action.payload.blocks,
                globalSettings: action.payload.settings,
                history: [action.payload.blocks],
                historyIndex: 0
            };

        case ActionTypes.UNDO: {
            if (state.historyIndex > 0) {
                const newIndex = state.historyIndex - 1;
                return {
                    ...state,
                    blocks: state.history[newIndex],
                    historyIndex: newIndex,
                    selectedBlockIds: []
                };
            }
            return state;
        }

        case ActionTypes.REDO: {
            if (state.historyIndex < state.history.length - 1) {
                const newIndex = state.historyIndex + 1;
                return {
                    ...state,
                    blocks: state.history[newIndex],
                    historyIndex: newIndex,
                    selectedBlockIds: []
                };
            }
            return state;
        }

        default:
            return state;
    }
};

// 4. FUNÇÃO PARA CRIAR NOVOS BLOCOS
export const createNewBlock = (blockType: BlockType): ExtendedBlock => {
    let defaultProps: ExtendedBlockProps = {};

    switch (blockType) {
        case 'heading':
            defaultProps = { children: 'Título Principal' };
            break;
        case 'text':
            defaultProps = { children: 'Escreva seu parágrafo aqui. Use este espaço para detalhar sua mensagem.' };
            break;
        case 'button':
            defaultProps = { children: 'Clique Aqui', href: 'https://example.com' }; // ✅ URL válida
            break;
        case 'image':
            defaultProps = { src: 'https://placehold.co/600x200', alt: 'Imagem de Exemplo' };
            break;
        case 'divider':
            defaultProps = {};
            break;
        case 'columns':
            defaultProps = {
                columns: [
                    { id: crypto.randomUUID(), content: 'Primeira coluna', width: '50%' },
                    { id: crypto.randomUUID(), content: 'Segunda coluna', width: '50%' }
                ]
            };
            break;
        case 'list':
            defaultProps = {
                listType: 'bullet',
                items: [
                    { id: crypto.randomUUID(), text: 'Primeiro item da lista' },
                    { id: crypto.randomUUID(), text: 'Segundo item da lista' }
                ]
            };
            break;
        case 'table':
            defaultProps = {
                tableHeaders: ['Produto', 'Preço'],
                tableRows: [
                    { id: crypto.randomUUID(), cells: ['Item 1', 'R$ 100,00'] },
                    { id: crypto.randomUUID(), cells: ['Item 2', 'R$ 200,00'] }
                ]
            };
            break;
        case 'spacer':
            defaultProps = { spacerHeight: '40px' };
            break;
        case 'social':
            defaultProps = {
                socialLinks: [
                    { id: 'facebook', name: 'Facebook', url: '' },
                    { id: 'instagram', name: 'Instagram', url: '' },
                    { id: 'twitter', name: 'Twitter', url: '' },
                ]
            };
            break;
    }

    // ✅ SANITIZAÇÃO: Sanitiza props ao criar bloco
    return {
        id: `block-${crypto.randomUUID()}`,
        type: blockType,
        props: sanitizeBlockProps(defaultProps),
        style: {}
    };
};