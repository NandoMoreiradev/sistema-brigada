export interface BlockStyle {
    backgroundColor?: string;
    textColor?: string;
    fontSize?: string;
    fontFamily?: string;
    textAlign?: 'left' | 'center' | 'right' | 'justify';
    // legacy string format (kept for backward compat)
    padding?: string;
    margin?: string;
    // per-side spacing (takes precedence over legacy fields)
    paddingTop?: number;
    paddingRight?: number;
    paddingBottom?: number;
    paddingLeft?: number;
    marginTop?: number;
    marginBottom?: number;
    borderRadius?: string;
    borderColor?: string;
    borderWidth?: string;
    iconColor?: string;
    iconSize?: string;
    width?: string;
}

export interface ColumnData {
    id: string;
    content: string;
    width?: string;
}

export interface ListItem {
    id: string;
    text: string;
}

export interface TableRow {
    id: string;
    cells: string[];
}

export interface SocialLink {
    id: 'facebook' | 'instagram' | 'twitter' | 'linkedin' | 'youtube' | 'tiktok' | 'whatsapp' |
        'telegram' | 'github' | 'dribbble' | 'behance' | 'email' | 'website';
    name: string;
    url: string;
}


export interface ExtendedBlockProps {
    children?: string;
    href?: string;
    src?: string;
    alt?: string;
    columns?: ColumnData[];
    items?: ListItem[];
    listType?: 'bullet' | 'numbered';
    tableHeaders?: string[];
    tableRows?: TableRow[];
    spacerHeight?: string;
    socialLinks?: SocialLink[];
    width?: string;
}


export type BlockType =
    'heading'
    | 'text'
    | 'button'
    | 'image'
    | 'divider'
    | 'columns'
    | 'list'
    | 'table'
    | 'spacer'
    | 'social';


export interface ExtendedBlock {
    id: string;
    type: BlockType;
    props: ExtendedBlockProps;
    style?: BlockStyle;
}

export interface GlobalEmailSettings {
    backgroundColor?: string;
    maxWidth?: string;
    fontFamily?: string;
    primaryColor?: string;
    secondaryColor?: string;
    textColor?: string;
}

export type EditorTab = 'components' | 'structure' | 'properties' | 'design';
