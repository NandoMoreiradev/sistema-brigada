import React, { useState, useCallback, useEffect } from 'react';
import styled from 'styled-components';
import { Plus, X } from 'phosphor-react';
import { useDebouncedCallback } from 'use-debounce';

import type { ExtendedBlockProps, TableRow } from '../../types';
import { Label, SmallButton } from '../../styles';

// =============================================================================
// STYLED COMPONENTS
// =============================================================================

const Section = styled.div`
    margin-bottom: 20px;
`;

const Header = styled.div`
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
`;

const HeadersContainer = styled.div`
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    margin-bottom: 12px;
`;

const HeaderInput = styled.input`
    flex: 1;
    min-width: 100px;
    padding: 6px 8px;
    border: 1px solid #ccc;
    border-radius: 4px;
    font-size: 13px;
    font-weight: 500;
    
    &:focus {
        outline: none;
        border-color: #2563eb;
        box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.1);
    }
`;

const RowContainer = styled.div`
    display: flex;
    gap: 8px;
    margin-bottom: 8px;
    align-items: center;
`;

const CellInput = styled.input`
    flex: 1;
    min-width: 80px;
    padding: 6px 8px;
    border: 1px solid #dee2e6;
    border-radius: 4px;
    font-size: 13px;
    
    &:focus {
        outline: none;
        border-color: #2563eb;
        box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.1);
    }
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

const RowLabel = styled.span`
    font-size: 12px;
    color: #6c757d;
    min-width: 30px;
`;

// =============================================================================
// INTERFACES
// =============================================================================

interface TablePropertiesProps {
    props: ExtendedBlockProps;
    onPropsChange: (newProps: ExtendedBlockProps) => void;
}

// =============================================================================
// COMPONENTE
// =============================================================================

export const TableProperties: React.FC<TablePropertiesProps> = ({ props, onPropsChange }) => {
    const [localHeaders, setLocalHeaders] = useState<string[]>(props.tableHeaders || ['Coluna 1']);
    const [localRows, setLocalRows] = useState<TableRow[]>(props.tableRows || []);

    // Sincronizar estado local quando props mudam externamente
    useEffect(() => {
        setLocalHeaders(props.tableHeaders || ['Coluna 1']);
        setLocalRows(props.tableRows || []);
    }, [props.tableHeaders, props.tableRows]);

    // Debounced update (500ms)
    const debouncedUpdate = useDebouncedCallback(
        (headers: string[], rows: TableRow[]) => {
            onPropsChange({ ...props, tableHeaders: headers, tableRows: rows });
        },
        500
    );

    // =========================================================================
    // HEADERS
    // =========================================================================

    const handleHeaderUpdate = useCallback((index: number, value: string) => {
        const updatedHeaders = [...localHeaders];
        updatedHeaders[index] = value;
        setLocalHeaders(updatedHeaders);

        debouncedUpdate(updatedHeaders, localRows);
    }, [localHeaders, localRows, debouncedUpdate]);

    const addColumn = useCallback(() => {
        const newHeaders = [...localHeaders, `Coluna ${localHeaders.length + 1}`];
        setLocalHeaders(newHeaders);

        // Adicionar célula vazia em todas as linhas
        const updatedRows = localRows.map(row => ({
            ...row,
            cells: [...row.cells, '']
        }));
        setLocalRows(updatedRows);

        onPropsChange({ ...props, tableHeaders: newHeaders, tableRows: updatedRows });
    }, [localHeaders, localRows, props, onPropsChange]);

    const removeColumn = useCallback((index: number) => {
        const updatedHeaders = localHeaders.filter((_, i) => i !== index);
        setLocalHeaders(updatedHeaders);

        // Remover célula correspondente em todas as linhas
        const updatedRows = localRows.map(row => ({
            ...row,
            cells: row.cells.filter((_, i) => i !== index)
        }));
        setLocalRows(updatedRows);

        onPropsChange({ ...props, tableHeaders: updatedHeaders, tableRows: updatedRows });
    }, [localHeaders, localRows, props, onPropsChange]);

    // =========================================================================
    // ROWS
    // =========================================================================

    const handleCellUpdate = useCallback((rowId: string, cellIndex: number, value: string) => {
        const updatedRows = localRows.map(row => {
            if (row.id === rowId) {
                const newCells = [...row.cells];
                newCells[cellIndex] = value;
                return { ...row, cells: newCells };
            }
            return row;
        });
        setLocalRows(updatedRows);
        debouncedUpdate(localHeaders, updatedRows);
    }, [localRows, localHeaders, debouncedUpdate]);

    const addRow = useCallback(() => {
        const newRow: TableRow = {
            id: crypto.randomUUID(),
            cells: new Array(localHeaders.length).fill('')
        };
        const updatedRows = [...localRows, newRow];
        setLocalRows(updatedRows);
        onPropsChange({ ...props, tableHeaders: localHeaders, tableRows: updatedRows });
    }, [localHeaders, localRows, props, onPropsChange]);

    const removeRow = useCallback((rowId: string) => {
        const updatedRows = localRows.filter(row => row.id !== rowId);
        setLocalRows(updatedRows);
        onPropsChange({ ...props, tableHeaders: localHeaders, tableRows: updatedRows });
    }, [localRows, localHeaders, props, onPropsChange]);

    return (
        <div>
            {/* HEADERS */}
            <Section>
                <Header>
                    <Label>Cabeçalhos da Tabela</Label>
                    <SmallButton
                        onClick={addColumn}
                        aria-label="Adicionar coluna"
                        title="Adicionar coluna"
                    >
                        <Plus size={12} /> Coluna
                    </SmallButton>
                </Header>

                <HeadersContainer>
                    {localHeaders.map((header, index) => (
                        <div key={index} style={{ display: 'flex', gap: '4px', flex: 1, minWidth: '120px' }}>
                            <HeaderInput
                                type="text"
                                value={header}
                                onChange={(e) => handleHeaderUpdate(index, e.target.value)}
                                placeholder={`Coluna ${index + 1}`}
                                aria-label={`Cabeçalho da coluna ${index + 1}`}
                            />
                            <SmallButton
                                onClick={() => removeColumn(index)}
                                aria-label={`Remover coluna ${index + 1}`}
                                title="Remover coluna"
                                disabled={localHeaders.length === 1}
                                style={{ flexShrink: 0 }}
                            >
                                <X size={12} />
                            </SmallButton>
                        </div>
                    ))}
                </HeadersContainer>
            </Section>

            {/* ROWS */}
            <Section>
                <Header>
                    <Label>Linhas da Tabela</Label>
                    <SmallButton
                        onClick={addRow}
                        aria-label="Adicionar linha"
                        title="Adicionar linha"
                    >
                        <Plus size={12} /> Linha
                    </SmallButton>
                </Header>

                {localRows.length === 0 ? (
                    <EmptyState>
                        Nenhuma linha adicionada.<br />
                        Clique em "Linha" para criar a primeira linha.
                    </EmptyState>
                ) : (
                    localRows.map((row, rowIndex) => (
                        <RowContainer key={row.id}>
                            <RowLabel>#{rowIndex + 1}</RowLabel>
                            {row.cells.map((cell, cellIndex) => (
                                <CellInput
                                    key={cellIndex}
                                    type="text"
                                    value={cell}
                                    onChange={(e) => handleCellUpdate(row.id, cellIndex, e.target.value)}
                                    placeholder={localHeaders[cellIndex] || `Col ${cellIndex + 1}`}
                                    aria-label={`Linha ${rowIndex + 1}, ${localHeaders[cellIndex] || `Coluna ${cellIndex + 1}`}`}
                                />
                            ))}
                            <SmallButton
                                onClick={() => removeRow(row.id)}
                                aria-label={`Remover linha ${rowIndex + 1}`}
                                title="Remover linha"
                                disabled={localRows.length === 1}
                                style={{ flexShrink: 0 }}
                            >
                                <X size={12} />
                            </SmallButton>
                        </RowContainer>
                    ))
                )}
            </Section>

            {(localHeaders.length > 0 || localRows.length > 0) && (
                <p style={{ fontSize: '11px', color: '#6c757d', marginTop: '8px' }}>
                    💡 Dica: A tabela será renderizada com {localHeaders.length} colunas e {localRows.length} linhas
                </p>
            )}
        </div>
    );
};