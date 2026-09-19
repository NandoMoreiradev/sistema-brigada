import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import type { BlockType } from '../types';
import { PaletteItemStyled } from '../styles';

interface PaletteItemProps {
    type: BlockType;
    name: string;
    icon: React.ElementType;
    isDragging: boolean;
}

export const PaletteItem: React.FC<PaletteItemProps> = ({ type, name, icon: Icon, isDragging }) => {
    const dragId = `palette-${type}`;
    const { attributes, listeners, setNodeRef } = useDraggable({
        id: dragId,
        data: {
            type: 'palette-item',
            blockType: type
        }
    });

    return (
        <PaletteItemStyled
            ref={setNodeRef}
            {...listeners}
            {...attributes}
            $isDragging={isDragging}
            title={`Arraste "${name}" para o e-mail`}
        >
            <Icon size={24} weight="regular" />
            <span>{name}</span>
        </PaletteItemStyled>
    );
};