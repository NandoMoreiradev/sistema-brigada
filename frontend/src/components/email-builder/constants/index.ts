import {
    TextT,
    Link as LinkIcon,
    Image as ImageIcon,
    Minus,
    Columns,
    List,
    Table,
    ArrowsOutCardinal,
    ShareNetwork,
    TextAa,
    StackSimple,
    SquaresFour,
} from 'phosphor-react';
import type { BlockType } from '../types';

export const PALETTE_ITEMS: { id: BlockType; name: string; icon: React.ElementType; category: string }[] = [
    // Componentes Básicos
    // --- REMOÇÃO: O bloco 'Título' foi removido ---
    { id: 'text', name: 'Texto', icon: TextT, category: 'básico' },
    { id: 'button', name: 'Botão', icon: LinkIcon, category: 'básico' },
    { id: 'image', name: 'Imagem', icon: ImageIcon, category: 'básico' },
    { id: 'divider', name: 'Divisor', icon: Minus, category: 'básico' },
    // Componentes Avançados
    { id: 'columns', name: 'Colunas', icon: Columns, category: 'layout' },
    { id: 'list', name: 'Lista', icon: List, category: 'conteúdo' },
    { id: 'table', name: 'Tabela', icon: Table, category: 'conteúdo' },
    { id: 'spacer', name: 'Espaçador', icon: ArrowsOutCardinal, category: 'layout' },
    { id: 'social', name: 'Mídias Sociais', icon: ShareNetwork, category: 'conteúdo' },
];

// Ordem e ícones das categorias da paleta (substitui os emojis antigos)
export const CATEGORY_META: { key: string; label: string; icon: React.ElementType }[] = [
    { key: 'básico', label: 'Básico', icon: TextAa },
    { key: 'layout', label: 'Layout', icon: StackSimple },
    { key: 'conteúdo', label: 'Conteúdo', icon: SquaresFour },
];

// Rótulos amigáveis em PT-BR por tipo de bloco (para títulos de painel)
export const BLOCK_LABELS: Record<BlockType, string> = {
    heading: 'Título',
    text: 'Texto',
    button: 'Botão',
    image: 'Imagem',
    divider: 'Divisor',
    columns: 'Colunas',
    list: 'Lista',
    table: 'Tabela',
    spacer: 'Espaçador',
    social: 'Mídias Sociais',
};

// Ícone por tipo de bloco, derivado da paleta
export const BLOCK_ICONS: Record<string, React.ElementType> = PALETTE_ITEMS.reduce(
    (acc, item) => {
        acc[item.id] = item.icon;
        return acc;
    },
    {} as Record<string, React.ElementType>,
);

export interface FontOption {
    value: string;
    label: string;
}

export interface FontGroup {
    group: string;
    fonts: FontOption[];
}

export const FONT_FAMILY_GROUPS: FontGroup[] = [
    {
        group: 'Fontes do Sistema',
        fonts: [
            { value: 'Arial, sans-serif', label: 'Arial' },
            { value: 'Helvetica, sans-serif', label: 'Helvetica' },
            { value: 'Tahoma, sans-serif', label: 'Tahoma' },
            { value: 'Verdana, sans-serif', label: 'Verdana' },
            { value: '"Trebuchet MS", sans-serif', label: 'Trebuchet MS' },
            { value: 'Georgia, serif', label: 'Georgia' },
            { value: '"Times New Roman", serif', label: 'Times New Roman' },
            { value: '"Courier New", monospace', label: 'Courier New' },
        ],
    },
    {
        group: 'Google Fonts — Sem Serifa',
        fonts: [
            { value: "'Roboto', sans-serif", label: 'Roboto' },
            { value: "'Open Sans', sans-serif", label: 'Open Sans' },
            { value: "'Lato', sans-serif", label: 'Lato' },
            { value: "'Montserrat', sans-serif", label: 'Montserrat' },
            { value: "'Poppins', sans-serif", label: 'Poppins' },
            { value: "'Raleway', sans-serif", label: 'Raleway' },
            { value: "'Nunito', sans-serif", label: 'Nunito' },
            { value: "'Oswald', sans-serif", label: 'Oswald' },
            { value: "'Source Sans 3', sans-serif", label: 'Source Sans 3' },
        ],
    },
    {
        group: 'Google Fonts — Com Serifa',
        fonts: [
            { value: "'Merriweather', serif", label: 'Merriweather' },
            { value: "'Playfair Display', serif", label: 'Playfair Display' },
            { value: "'Lora', serif", label: 'Lora' },
            { value: "'PT Serif', serif", label: 'PT Serif' },
        ],
    },
    {
        group: 'Google Fonts — Decorativas',
        fonts: [
            { value: "'Dancing Script', cursive", label: 'Dancing Script' },
            { value: "'Pacifico', cursive", label: 'Pacifico' },
        ],
    },
];

// Mantido para compatibilidade — lista plana derivada dos grupos
export const FONT_FAMILIES: FontOption[] = FONT_FAMILY_GROUPS.flatMap(g => g.fonts);

export const FONT_SIZES = [
    { value: '12px', label: '12px' },
    { value: '14px', label: '14px' },
    { value: '16px', label: '16px' },
    { value: '18px', label: '18px' },
    { value: '20px', label: '20px' },
    { value: '24px', label: '24px' },
    { value: '28px', label: '28px' },
    { value: '32px', label: '32px' },
    { value: '36px', label: '36px' },
];
