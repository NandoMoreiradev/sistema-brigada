import React, { useState, useCallback, useEffect } from 'react';
import styled from 'styled-components';
import { Plus, X } from 'phosphor-react';
import { useDebouncedCallback } from 'use-debounce';

import type { ExtendedBlockProps, ColumnData } from '../../types';
import { Label, ColumnContainer, SmallButton } from '../../styles';

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

// =============================================================================
// INTERFACES
// =============================================================================

interface ColumnsPropertiesProps {
    props: ExtendedBlockProps;
    onPropsChange: (newProps: ExtendedBlockProps) => void;
}

// =============================================================================
// COMPONENTE
// =============================================================================

export const ColumnsProperties: React.FC<ColumnsPropertiesProps> = ({ props, onPropsChange }) => {
    const [localColumns, setLocalColumns] = useState<ColumnData[]>(props.columns || []);

    // Sincronizar estado local quando props mudam externamente
    useEffect(() => {
        setLocalColumns(props.columns || []);
    }, [props.columns]);

    // Debounced update (500ms)
    const debouncedUpdate = useDebouncedCallback(
        (updatedColumns: ColumnData[]) => {
            onPropsChange({ ...props, columns: updatedColumns });
        },
        500
    );

    const handleColumnUpdate = useCallback((columnId: string, content: string) => {
        const updatedColumns = localColumns.map((col) =>
            col.id === columnId ? { ...col, content } : col
        );
        setLocalColumns(updatedColumns);
        debouncedUpdate(updatedColumns);
    }, [localColumns, debouncedUpdate]);

    const addColumn = useCallback(() => {
        const newColumn: ColumnData = {
            id: crypto.randomUUID(),
            content: 'Nova coluna',
            width: '33.33%',
        };
        const updatedColumns = [...localColumns, newColumn];
        setLocalColumns(updatedColumns);
        onPropsChange({ ...props, columns: updatedColumns });
    }, [localColumns, props, onPropsChange]);

    const removeColumn = useCallback((columnId: string) => {
        const updatedColumns = localColumns.filter((col) => col.id !== columnId);
        setLocalColumns(updatedColumns);
        onPropsChange({ ...props, columns: updatedColumns });
    }, [localColumns, props, onPropsChange]);

    return (
        <div>
            <Header>
                <Label>Colunas</Label>
                <SmallButton
                    onClick={addColumn}
                    aria-label="Adicionar nova coluna"
                    title="Adicionar coluna"
                >
                    <Plus size={12} /> Adicionar
                </SmallButton>
            </Header>

            {localColumns.length === 0 ? (
                <EmptyState>
                    Nenhuma coluna adicionada.<br />
                    Clique em "Adicionar" para criar a primeira coluna.
                </EmptyState>
            ) : (
                localColumns.map((column, index) => (
                    <ColumnContainer key={column.id}>
                        <ItemInput
                            type="text"
                            value={column.content}
                            onChange={(e) => handleColumnUpdate(column.id, e.target.value)}
                            placeholder={`Conteúdo da coluna ${index + 1}`}
                            aria-label={`Conteúdo da coluna ${index + 1}`}
                        />
                        <SmallButton
                            onClick={() => removeColumn(column.id)}
                            aria-label={`Remover coluna ${index + 1}`}
                            title="Remover coluna"
                            disabled={localColumns.length === 1}
                        >
                            <X size={12} />
                        </SmallButton>
                    </ColumnContainer>
                ))
            )}

            {localColumns.length > 0 && (
                <p style={{ fontSize: '11px', color: '#6c757d', marginTop: '8px' }}>
                    💡 Dica: Você pode adicionar até 4 colunas. Cada coluna ajustará automaticamente sua largura.
                </p>
            )}
        </div>
    );
};