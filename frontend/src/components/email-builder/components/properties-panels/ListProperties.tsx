import React, { useState, useCallback, useEffect } from 'react';
import styled from 'styled-components';
import { Plus, X } from 'phosphor-react';
import { useDebouncedCallback } from 'use-debounce';

import type { ExtendedBlockProps, ListItem } from '../../types';
import { Label, ColumnContainer, SmallButton, Select } from '../../styles';

// =============================================================================
// STYLED COMPONENTS
// =============================================================================

const ItemInput = styled.input`
    flex: 1;
    padding: 6px 8px;
    border: 1px solid #ccc;
    border-radius: 4px;
    font-size: 13px;

    &:focus {
        outline: none;
        border-color: #2563eb;
        box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.1);
    }
`;

const Header = styled.div`
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
`;

const EmptyState = styled.div`
    text-align: center;
    padding: 20px;
    background-color: #f8f9fa;
    border-radius: 6px;
    border: 1px dashed #dee2e6;
    color: #6c757d;
    font-size: 13px;
`;

const TypeSelector = styled.div`
    margin-bottom: 16px;
`;

// =============================================================================
// INTERFACES
// =============================================================================

interface ListPropertiesProps {
    props: ExtendedBlockProps;
    onPropsChange: (newProps: ExtendedBlockProps) => void;
}

// =============================================================================
// COMPONENTE
// =============================================================================

export const ListProperties: React.FC<ListPropertiesProps> = ({ props, onPropsChange }) => {
    const [localItems, setLocalItems] = useState<ListItem[]>(props.items || []);
    const [listType, setListType] = useState<'bullet' | 'numbered'>(props.listType || 'bullet');

    // Sincronizar estado local quando props mudam externamente
    useEffect(() => {
        setLocalItems(props.items || []);
        setListType(props.listType || 'bullet');
    }, [props.items, props.listType]);

    // Debounced update (500ms)
    const debouncedUpdate = useDebouncedCallback(
        (updatedItems: ListItem[]) => {
            onPropsChange({ ...props, items: updatedItems, listType });
        },
        500
    );

    const handleItemUpdate = useCallback((itemId: string, text: string) => {
        const updatedItems = localItems.map((item) =>
            item.id === itemId ? { ...item, text } : item
        );
        setLocalItems(updatedItems);
        debouncedUpdate(updatedItems);
    }, [localItems, debouncedUpdate]);

    const addItem = useCallback(() => {
        const newItem: ListItem = {
            id: crypto.randomUUID(),
            text: 'Novo item',
        };
        const updatedItems = [...localItems, newItem];
        setLocalItems(updatedItems);
        onPropsChange({ ...props, items: updatedItems, listType });
    }, [localItems, props, listType, onPropsChange]);

    const removeItem = useCallback((itemId: string) => {
        const updatedItems = localItems.filter((item) => item.id !== itemId);
        setLocalItems(updatedItems);
        onPropsChange({ ...props, items: updatedItems, listType });
    }, [localItems, props, listType, onPropsChange]);

    const handleListTypeChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
        const newType = e.target.value as 'bullet' | 'numbered';
        setListType(newType);
        onPropsChange({ ...props, items: localItems, listType: newType });
    }, [props, localItems, onPropsChange]);

    return (
        <div>
            <TypeSelector>
                <Label>Tipo de Lista</Label>
                <Select
                    value={listType}
                    onChange={handleListTypeChange}
                    aria-label="Selecionar tipo de lista"
                >
                    <option value="bullet">• Lista com marcadores</option>
                    <option value="numbered">1. Lista numerada</option>
                </Select>
            </TypeSelector>

            <Header>
                <Label>Itens da Lista</Label>
                <SmallButton
                    onClick={addItem}
                    aria-label="Adicionar novo item"
                    title="Adicionar item"
                >
                    <Plus size={12} /> Adicionar
                </SmallButton>
            </Header>

            {localItems.length === 0 ? (
                <EmptyState>
                    Nenhum item adicionado.<br />
                    Clique em "Adicionar" para criar o primeiro item.
                </EmptyState>
            ) : (
                localItems.map((item, index) => (
                    <ColumnContainer key={item.id}>
                        <span style={{
                            marginRight: '8px',
                            color: '#6c757d',
                            fontSize: '12px',
                            minWidth: '20px'
                        }}>
                            {listType === 'numbered' ? `${index + 1}.` : '•'}
                        </span>
                        <ItemInput
                            type="text"
                            value={item.text}
                            onChange={(e) => handleItemUpdate(item.id, e.target.value)}
                            placeholder={`Item ${index + 1}`}
                            aria-label={`Item ${index + 1} da lista`}
                        />
                        <SmallButton
                            onClick={() => removeItem(item.id)}
                            aria-label={`Remover item ${index + 1}`}
                            title="Remover item"
                            disabled={localItems.length === 1}
                        >
                            <X size={12} />
                        </SmallButton>
                    </ColumnContainer>
                ))
            )}

            {localItems.length > 0 && (
                <p style={{ fontSize: '11px', color: '#6c757d', marginTop: '8px' }}>
                    💡 Dica: Use Enter nos inputs para adicionar itens rapidamente
                </p>
            )}
        </div>
    );
};