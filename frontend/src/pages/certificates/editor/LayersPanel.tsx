// frontend/src/pages/certificates/editor/LayersPanel.tsx
//
// Camadas do certificado: a de cima da lista é a que fica por cima na página
// (ordem inversa da lista de elementos do layout, que é a ordem de desenho).
// Arrastar reordena; olho oculta; cadeado trava a posição.

import styled from 'styled-components';
import { DndContext, PointerSensor, KeyboardSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Eye, EyeOff, GripVertical, Lock, Unlock } from 'lucide-react';
import type { LayoutElement } from '../layout/types';
import { ELEMENT_TYPE_LABEL, elementLabel } from './layoutUtils';

const List = styled.ul`
    list-style: none;
    margin: 0;
    padding: 0.25rem 0.5rem 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 2px;
`;

const Item = styled.li<{ $selected: boolean; $hidden: boolean }>`
    display: flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.3rem 0.35rem;
    border-radius: 6px;
    font-size: 0.78rem;
    background: ${({ $selected, theme }) => ($selected ? theme.colors.primaryLight : 'transparent')};
    color: ${({ $selected, theme }) => ($selected ? theme.colors.primary : theme.colors.textDark)};
    opacity: ${({ $hidden }) => ($hidden ? 0.5 : 1)};
    cursor: pointer;

    &:hover {
        background: ${({ $selected, theme }) => ($selected ? theme.colors.primaryLight : theme.colors.lightGray)};
    }

    .label {
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .type {
        font-size: 0.65rem;
        color: ${({ theme }) => theme.colors.textMuted};
    }

    button {
        display: inline-flex;
        border: none;
        background: none;
        padding: 0.15rem;
        border-radius: 4px;
        color: ${({ theme }) => theme.colors.textMuted};
        cursor: pointer;
    }

    button:hover {
        color: ${({ theme }) => theme.colors.textDark};
        background: rgba(15, 23, 42, 0.06);
    }

    .grip {
        cursor: grab;
        touch-action: none;
    }
`;

function LayerRow({
    element,
    selected,
    onSelect,
    onToggle,
}: {
    element: LayoutElement;
    selected: boolean;
    onSelect: () => void;
    onToggle: (patch: Partial<LayoutElement>) => void;
}) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: element.id });
    return (
        <Item
            ref={setNodeRef}
            style={{ transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 2 : undefined, position: 'relative' }}
            $selected={selected}
            $hidden={!!element.hidden}
            onClick={onSelect}
        >
            <button type="button" className="grip" aria-label="Arrastar para reordenar" {...attributes} {...listeners} onClick={(e) => e.stopPropagation()}>
                <GripVertical size={14} />
            </button>
            <span className="label" title={elementLabel(element)}>
                {elementLabel(element)} <span className="type">· {ELEMENT_TYPE_LABEL[element.type]}</span>
            </span>
            <button
                type="button"
                aria-label={element.hidden ? 'Mostrar' : 'Ocultar'}
                title={element.hidden ? 'Mostrar' : 'Ocultar (não sai no PDF)'}
                onClick={(e) => {
                    e.stopPropagation();
                    onToggle({ hidden: !element.hidden });
                }}
            >
                {element.hidden ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
            <button
                type="button"
                aria-label={element.locked ? 'Destravar' : 'Travar'}
                title={element.locked ? 'Destravar' : 'Travar posição'}
                onClick={(e) => {
                    e.stopPropagation();
                    onToggle({ locked: !element.locked });
                }}
            >
                {element.locked ? <Lock size={14} /> : <Unlock size={14} style={{ opacity: 0.45 }} />}
            </button>
        </Item>
    );
}

interface Props {
    elements: LayoutElement[];
    selectedId: string | null;
    onSelect: (id: string) => void;
    onToggle: (id: string, patch: Partial<LayoutElement>) => void;
    onReorder: (elements: LayoutElement[]) => void;
}

export function LayersPanel({ elements, selectedId, onSelect, onToggle, onReorder }: Props) {
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    );
    const topFirst = [...elements].reverse();

    const handleDragEnd = ({ active, over }: DragEndEvent) => {
        if (!over || active.id === over.id) return;
        const from = topFirst.findIndex((element) => element.id === active.id);
        const to = topFirst.findIndex((element) => element.id === over.id);
        onReorder(arrayMove(topFirst, from, to).reverse());
    };

    return (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={topFirst.map((element) => element.id)} strategy={verticalListSortingStrategy}>
                <List>
                    {topFirst.map((element) => (
                        <LayerRow
                            key={element.id}
                            element={element}
                            selected={element.id === selectedId}
                            onSelect={() => onSelect(element.id)}
                            onToggle={(patch) => onToggle(element.id, patch)}
                        />
                    ))}
                </List>
            </SortableContext>
        </DndContext>
    );
}
