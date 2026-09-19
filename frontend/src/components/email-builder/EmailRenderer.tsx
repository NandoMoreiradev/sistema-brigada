import React, { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import {
    Button,
    Heading,
    Html,
    Text,
    Section,
    Container,
    Hr,
    Img,
    Column,
    Row
} from '@react-email/components';

// --- INTERFACES EXPANDIDAS ---
interface BlockStyle {
    backgroundColor?: string;
    textColor?: string;
    fontSize?: string;
    fontFamily?: string;
    textAlign?: 'left' | 'center' | 'right' | 'justify';
    padding?: string;
    margin?: string;
    borderRadius?: string;
    borderColor?: string;
    borderWidth?: string;
}

interface ColumnData {
    id: string;
    content: string;
    width?: string;
}

interface ListItem {
    id: string;
    text: string;
}

interface TableRow {
    id: string;
    cells: string[];
}

interface ExtendedBlockProps {
    children?: string;
    href?: string;
    src?: string;
    alt?: string;
    // Componentes avançados
    columns?: ColumnData[];
    items?: ListItem[];
    listType?: 'bullet' | 'numbered';
    tableHeaders?: string[];
    tableRows?: TableRow[];
    spacerHeight?: string;
}

export interface Block {
    id: string;
    type: 'heading' | 'text' | 'button' | 'image' | 'divider' | 'columns' | 'list' | 'table' | 'spacer';
    props: ExtendedBlockProps;
    style?: BlockStyle;
}

interface GlobalEmailSettings {
    backgroundColor?: string;
    maxWidth?: string;
    fontFamily?: string;
    primaryColor?: string;
    secondaryColor?: string;
    textColor?: string;
}

// --- STYLED COMPONENTS ---
const DropZone = styled.div<{ $isOver: boolean; $isDragging: boolean; $isEmpty?: boolean }>`
    height: ${({ $isDragging, $isEmpty }) => {
    if ($isEmpty && $isDragging) return '80px';
    if ($isDragging) return '40px';
    return '4px';
}};
    background-color: ${({ $isOver }) => $isOver ? 'rgba(0, 121, 107, 0.1)' : 'transparent'};
    transition: all 0.2s ease-in-out;
    position: relative;
    margin: 8px 0;
    border: ${({ $isOver, $isDragging, $isEmpty }) => {
    if ($isOver) return '2px dashed #00796b';
    if ($isEmpty && $isDragging) return '2px dashed #ccc';
    return '2px dashed transparent';
}};
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;

    &::before {
        content: ${({ $isOver, $isEmpty, $isDragging }) => {
    if ($isOver) return '"Solte o componente aqui"';
    if ($isEmpty && $isDragging) return '"Arraste um componente para começar"';
    return '""';
}};
        font-size: 14px;
        color: ${({ $isOver }) => $isOver ? '#00796b' : '#999'};
        font-weight: 500;
    }
`;

const EmailContainer = styled.div`
    min-height: 400px;
    padding: 20px;
    position: relative;
`;

// --- INTERFACES DO COMPONENTE ---
interface EmailRendererProps {
    blocks: Block[];
    globalSettings?: GlobalEmailSettings;
}

export const EmailRenderer: React.FC<EmailRendererProps> = ({
                                                                blocks,
                                                                globalSettings = {
                                                                    backgroundColor: '#ffffff',
                                                                    maxWidth: '600px',
                                                                    fontFamily: 'Arial, sans-serif',
                                                                    primaryColor: '#007bff',
                                                                    secondaryColor: '#6c757d',
                                                                    textColor: '#333333'
                                                                }
                                                            }) => {
    const [isDragging, setIsDragging] = useState(false);
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

    // --- HANDLERS DE DRAG & DROP ---
    const handleDragOver = useCallback((e: DragEvent, index: number) => {
        e.preventDefault();
        e.stopPropagation();
        setHoveredIndex(index);
        window.parent.postMessage({ type: 'IFRAME_DRAG_OVER', payload: { index } }, '*');
    }, []);

    const handleDragLeave = useCallback((e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();

        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const x = e.clientX;
        const y = e.clientY;

        if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
            setHoveredIndex(null);
            window.parent.postMessage({ type: 'IFRAME_DRAG_LEAVE' }, '*');
        }
    }, []);

    const handleDrop = useCallback((e: DragEvent, index: number) => {
        e.preventDefault();
        e.stopPropagation();
        setHoveredIndex(null);
        window.parent.postMessage({ type: 'IFRAME_DROP', payload: { index } }, '*');
    }, []);

    // --- COMUNICAÇÃO COM PARENT ---
    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            const { type } = event.data;

            if (type === 'TEST_CONNECTION') {
                window.parent.postMessage({ type: 'CONNECTION_OK' }, '*');
                return;
            }

            if (type === 'DRAG_START') {
                setIsDragging(true);
            }
            if (type === 'DRAG_END') {
                setIsDragging(false);
                setHoveredIndex(null);
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, []);

    useEffect(() => {
        if (!isDragging) return;

        const handleGlobalDragOver = (e: DragEvent) => e.preventDefault();
        const handleGlobalDrop = (e: DragEvent) => e.preventDefault();

        document.addEventListener('dragover', handleGlobalDragOver);
        document.addEventListener('drop', handleGlobalDrop);

        return () => {
            document.removeEventListener('dragover', handleGlobalDragOver);
            document.removeEventListener('drop', handleGlobalDrop);
        };
    }, [isDragging]);

    // --- FUNÇÃO PRINCIPAL DE RENDERIZAÇÃO ---
    const renderBlock = (block: Block) => {
        const blockStyle = block.style || {};

        const baseStyle = {
            fontSize: blockStyle.fontSize || '16px',
            fontFamily: blockStyle.fontFamily || globalSettings.fontFamily,
            color: blockStyle.textColor || globalSettings.textColor,
            margin: blockStyle.margin || '16px 0',
            padding: blockStyle.padding || '8px',
            backgroundColor: blockStyle.backgroundColor,
            borderRadius: blockStyle.borderRadius,
            border: blockStyle.borderWidth ?
                `${blockStyle.borderWidth} solid ${blockStyle.borderColor || '#e0e0e0'}` :
                undefined,
            textAlign: blockStyle.textAlign || 'left' as const
        };

        switch (block.type) {
            case 'heading':
                return (
                    <Section key={block.id} style={{ margin: baseStyle.margin }}>
                        <Heading
                            as="h1"
                            style={{
                                ...baseStyle,
                                fontSize: blockStyle.fontSize || '24px',
                                fontWeight: 'bold',
                                margin: '0'
                            }}
                        >
                            {block.props.children || 'Título'}
                        </Heading>
                    </Section>
                );

            case 'text':
                return (
                    <Section key={block.id} style={{ margin: baseStyle.margin }}>
                        <Text style={{
                            ...baseStyle,
                            lineHeight: '1.5',
                            margin: '0'
                        }}>
                            {block.props.children || 'Texto'}
                        </Text>
                    </Section>
                );

            case 'button':
                return (
                    <Section
                        key={block.id}
                        style={{
                            textAlign: baseStyle.textAlign || 'center',
                            margin: baseStyle.margin
                        }}
                    >
                        <Button
                            href={block.props.href || '#'}
                            style={{
                                backgroundColor: blockStyle.backgroundColor || globalSettings.primaryColor,
                                color: blockStyle.textColor || '#ffffff',
                                padding: blockStyle.padding || '12px 24px',
                                borderRadius: blockStyle.borderRadius || '6px',
                                textDecoration: 'none',
                                fontWeight: '500',
                                display: 'inline-block',
                                fontSize: blockStyle.fontSize || '16px',
                                fontFamily: blockStyle.fontFamily || globalSettings.fontFamily,
                                border: blockStyle.borderWidth ?
                                    `${blockStyle.borderWidth} solid ${blockStyle.borderColor || '#ccc'}` :
                                    'none'
                            }}
                        >
                            {block.props.children || 'Botão'}
                        </Button>
                    </Section>
                );

            case 'image':
                return (
                    <Section
                        key={block.id}
                        style={{
                            textAlign: baseStyle.textAlign || 'center',
                            margin: baseStyle.margin
                        }}
                    >
                        <Img
                            src={block.props.src || 'https://via.placeholder.com/600x200'}
                            alt={block.props.alt || 'Imagem'}
                            style={{
                                maxWidth: '100%',
                                height: 'auto',
                                border: blockStyle.borderWidth ?
                                    `${blockStyle.borderWidth} solid ${blockStyle.borderColor || '#e0e0e0'}` :
                                    '1px solid #e0e0e0',
                                borderRadius: blockStyle.borderRadius || '4px',
                                backgroundColor: blockStyle.backgroundColor
                            }}
                        />
                    </Section>
                );

            case 'divider':
                return (
                    <Section key={block.id} style={{ margin: baseStyle.margin }}>
                        <Hr style={{
                            borderColor: blockStyle.borderColor || '#e0e0e0',
                            borderWidth: blockStyle.borderWidth || '1px',
                            margin: '0',
                            backgroundColor: blockStyle.backgroundColor || 'transparent'
                        }} />
                    </Section>
                );

            // --- COMPONENTES AVANÇADOS ---
            case 'columns':
                const columns = block.props.columns || [
                    { id: '1', content: 'Coluna 1', width: '50%' },
                    { id: '2', content: 'Coluna 2', width: '50%' }
                ];

                return (
                    <Section key={block.id} style={{ margin: baseStyle.margin }}>
                        <Row style={{ width: '100%' }}>
                            {columns.map((column) => (
                                <Column
                                    key={column.id}
                                    style={{
                                        width: column.width || `${100 / columns.length}%`,
                                        padding: blockStyle.padding || '12px',
                                        backgroundColor: blockStyle.backgroundColor || '#f8f9fa',
                                        border: blockStyle.borderWidth ?
                                            `${blockStyle.borderWidth} solid ${blockStyle.borderColor || '#e9ecef'}` :
                                            '1px solid #e9ecef',
                                        borderRadius: blockStyle.borderRadius || '4px'
                                    }}
                                >
                                    <Text style={{
                                        fontSize: blockStyle.fontSize || '14px',
                                        fontFamily: blockStyle.fontFamily || globalSettings.fontFamily,
                                        color: blockStyle.textColor || globalSettings.textColor,
                                        margin: '0',
                                        textAlign: baseStyle.textAlign
                                    }}>
                                        {column.content}
                                    </Text>
                                </Column>
                            ))}
                        </Row>
                    </Section>
                );

            case 'list':
                const items = block.props.items || [
                    { id: '1', text: 'Item da lista 1' },
                    { id: '2', text: 'Item da lista 2' },
                    { id: '3', text: 'Item da lista 3' }
                ];
                const listType = block.props.listType || 'bullet';

                return (
                    <Section key={block.id} style={{ margin: baseStyle.margin }}>
                        <div style={{
                            paddingLeft: '20px',
                            backgroundColor: blockStyle.backgroundColor,
                            padding: blockStyle.padding || '8px',
                            borderRadius: blockStyle.borderRadius
                        }}>
                            {items.map((item, index) => (
                                <Text
                                    key={item.id}
                                    style={{
                                        fontSize: blockStyle.fontSize || '16px',
                                        fontFamily: blockStyle.fontFamily || globalSettings.fontFamily,
                                        color: blockStyle.textColor || globalSettings.textColor,
                                        marginBottom: '8px',
                                        lineHeight: '1.6',
                                        textAlign: baseStyle.textAlign
                                    }}
                                >
                                    {listType === 'numbered' ? `${index + 1}. ` : '• '}
                                    {item.text}
                                </Text>
                            ))}
                        </div>
                    </Section>
                );

            case 'table':
                const headers = block.props.tableHeaders || ['Coluna 1', 'Coluna 2', 'Coluna 3'];
                const rows = block.props.tableRows || [
                    { id: '1', cells: ['Dado 1', 'Dado 2', 'Dado 3'] },
                    { id: '2', cells: ['Dado 4', 'Dado 5', 'Dado 6'] }
                ];

                return (
                    <Section key={block.id} style={{ margin: baseStyle.margin }}>
                        <table style={{
                            width: '100%',
                            borderCollapse: 'collapse',
                            fontSize: blockStyle.fontSize || '14px',
                            fontFamily: blockStyle.fontFamily || globalSettings.fontFamily,
                            backgroundColor: blockStyle.backgroundColor || '#ffffff'
                        }}>
                            <thead>
                            <tr>
                                {headers.map((header, index) => (
                                    <th key={index} style={{
                                        padding: '12px',
                                        border: `1px solid ${blockStyle.borderColor || '#dee2e6'}`,
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
                                            border: `1px solid ${blockStyle.borderColor || '#dee2e6'}`,
                                            backgroundColor: '#ffffff',
                                            color: blockStyle.textColor || globalSettings.textColor
                                        }}>
                                            {cell}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                            </tbody>
                        </table>
                    </Section>
                );

            case 'spacer':
                const height = block.props.spacerHeight || '40px';
                return (
                    <Section key={block.id} style={{ margin: baseStyle.margin }}>
                        <div style={{
                            height,
                            backgroundColor: blockStyle.backgroundColor || 'transparent',
                            width: '100%'
                        }} />
                    </Section>
                );

            default:
                return null;
        }
    };

    // --- RENDERIZAÇÃO DAS DROP ZONES ---
    const renderDropZone = (index: number) => {
        const dropZoneRef = useCallback((node: HTMLDivElement | null) => {
            if (!node) return;

            const handleDragOverBound = (e: DragEvent) => handleDragOver(e, index);
            const handleDragLeaveBound = (e: DragEvent) => handleDragLeave(e);
            const handleDropBound = (e: DragEvent) => handleDrop(e, index);

            node.addEventListener('dragover', handleDragOverBound);
            node.addEventListener('dragleave', handleDragLeaveBound);
            node.addEventListener('drop', handleDropBound);

            return () => {
                node.removeEventListener('dragover', handleDragOverBound);
                node.removeEventListener('dragleave', handleDragLeaveBound);
                node.removeEventListener('drop', handleDropBound);
            };
        }, [index]);

        return (
            <DropZone
                ref={dropZoneRef}
                $isOver={hoveredIndex === index}
                $isDragging={isDragging}
                $isEmpty={blocks.length === 0 && index === 0}
            />
        );
    };

    // --- RENDERIZAÇÃO PRINCIPAL ---
    return (
        <Html>
            <EmailContainer>
                <Container style={{
                    maxWidth: globalSettings.maxWidth || '600px',
                    margin: '0 auto',
                    backgroundColor: globalSettings.backgroundColor || '#ffffff',
                    fontFamily: globalSettings.fontFamily || 'Arial, sans-serif',
                    color: globalSettings.textColor || '#333333'
                }}>
                    {/* Drop zone inicial */}
                    {isDragging && renderDropZone(0)}

                    {/* Renderizar blocos */}
                    {blocks.map((block, index) => (
                        <React.Fragment key={block.id}>
                            {renderBlock(block)}
                            {isDragging && renderDropZone(index + 1)}
                        </React.Fragment>
                    ))}

                    {/* Empty state */}
                    {blocks.length === 0 && (
                        <div style={{
                            textAlign: 'center',
                            padding: '60px 20px',
                            color: '#999',
                            fontSize: '16px',
                            border: isDragging ? '2px dashed #00796b' : '2px dashed #ddd',
                            borderRadius: '8px',
                            backgroundColor: isDragging ? 'rgba(0, 121, 107, 0.05)' : '#f9f9f9',
                            transition: 'all 0.2s ease'
                        }}>
                            {isDragging ? 'Solte o componente aqui para começar' : 'Seu email aparecerá aqui'}
                        </div>
                    )}
                </Container>
            </EmailContainer>
        </Html>
    );
};