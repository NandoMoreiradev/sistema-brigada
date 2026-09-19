import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { DropZone } from '../styles';

interface EmailDropZoneProps {
    index: number;
    isDragging: boolean;
    isEmpty: boolean;
}

export const EmailDropZone: React.FC<EmailDropZoneProps> = ({ index, isDragging, isEmpty }) => {
    const dropId = `email-drop-${index}`;
    const { isOver, setNodeRef } = useDroppable({
        id: dropId,
        data: {
            type: 'email-drop-zone',
            index,
            isEmpty
        }
    });

    return (
        <DropZone
            ref={setNodeRef}
            $isOver={isOver}
            $isDragging={isDragging}
            $isEmpty={isEmpty}
        />
    );
};