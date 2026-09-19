import React from 'react';
import {useSortable} from '@dnd-kit/sortable';
import {CSS} from '@dnd-kit/utilities';
import {Copy, PencilSimple, Trash, DotsSixVertical, TextT} from 'phosphor-react';
import type {ExtendedBlock} from '../types';
import {BLOCK_LABELS, BLOCK_ICONS} from '../constants';
import {tokens} from '../styles/tokens';

interface SortableBlockItemProps {
    block: ExtendedBlock;
    isSelected: boolean;
    // 1. A assinatura do onSelect foi atualizada para incluir o evento do rato
    onSelect: (id: string, e: React.MouseEvent) => void;
    onDelete: (id: string) => void;
    onDuplicate: (id: string) => void;
}

export const SortableBlockItem: React.FC<SortableBlockItemProps> = ({
                                                                        block,
                                                                        isSelected,
                                                                        onSelect,
                                                                        onDelete,
                                                                        onDuplicate
                                                                    }) => {
    const {attributes, listeners, setNodeRef, transform, transition, isDragging} = useSortable({
        id: `structure-${block.id}`,
        data: {
            type: 'structure-item',
            blockId: block.id
        }
    });

    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
        padding: '9px 10px',
        border: `1px solid ${isSelected ? tokens.color.accent : tokens.color.line}`,
        backgroundColor: isSelected ? tokens.color.accentSoft : tokens.color.surface,
        marginBottom: '8px',
        borderRadius: tokens.radius.md,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: isDragging ? tokens.shadow.md : 'none',
        opacity: isDragging ? 0.9 : 1,
        zIndex: isDragging ? 1000 : 1,
        cursor: 'default'
    };

    const getBlockPreviewText = (block: ExtendedBlock) => {
        if (block.props.children && typeof block.props.children === 'string') {
            return block.props.children;
        }
        if (block.type === 'image' && block.props.alt) {
            return block.props.alt;
        }
        return '';
    }

    const previewText = getBlockPreviewText(block);
    const BlockIcon = BLOCK_ICONS[block.type] || TextT;
    const label = BLOCK_LABELS[block.type] || block.type;

    return (
        <div ref={setNodeRef} style={style}>
            <div style={{display: 'flex', alignItems: 'center', flexGrow: 1, overflow: 'hidden'}}>
                <div {...attributes} {...listeners} style={{
                    cursor: 'grab',
                    display: 'flex',
                    alignItems: 'center',
                    paddingRight: '8px',
                    color: tokens.color.faint
                }}>
                    <DotsSixVertical size={18}/>
                </div>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '28px',
                    height: '28px',
                    borderRadius: tokens.radius.sm,
                    background: isSelected ? tokens.color.surface : tokens.color.surfaceAlt,
                    color: isSelected ? tokens.color.accent : tokens.color.muted,
                    flexShrink: 0,
                    marginRight: '8px',
                }}>
                    <BlockIcon size={15} weight="bold"/>
                </div>
                {/* 2. O evento 'e' agora é passado para a função onSelect */}
                <div onClick={(e) => onSelect(block.id, e)} style={{
                    flexGrow: 1,
                    cursor: 'pointer',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    fontSize: '13px',
                }}>
                    <span style={{fontWeight: 600, color: tokens.color.ink}}>{label}</span>
                    {previewText && (
                        <span style={{marginLeft: '8px', fontSize: '12px', color: tokens.color.faint}}>
                            {previewText.substring(0, 18)}{previewText.length > 18 ? '…' : ''}
                        </span>
                    )}
                </div>
            </div>
            <div style={{display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '8px'}}>
                <button
                    type="button"
                    title="Editar"
                    onClick={(e) => {
                        e.stopPropagation();
                        // 3. O evento 'e' também é passado aqui
                        onSelect(block.id, e);
                    }}
                    style={{all: 'unset', cursor: 'pointer', color: tokens.color.faint, display: 'flex'}}
                >
                    <PencilSimple size={16}/>
                </button>
                <button
                    type="button"
                    title="Duplicar"
                    onClick={(e) => {
                        e.stopPropagation();
                        onDuplicate(block.id);
                    }}
                    style={{all: 'unset', cursor: 'pointer', color: tokens.color.faint, display: 'flex'}}
                >
                    <Copy size={16}/>
                </button>
                <button
                    type="button"
                    title="Excluir"
                    onClick={(e) => {
                        e.stopPropagation();
                        onDelete(block.id);
                    }}
                    style={{all: 'unset', cursor: 'pointer', color: tokens.color.danger, display: 'flex'}}
                >
                    <Trash size={16}/>
                </button>
            </div>
        </div>
    );
};
