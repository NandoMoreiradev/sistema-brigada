import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import * as Popover from '@radix-ui/react-popover';
import styled from 'styled-components';
import { Tag, Spinner } from 'phosphor-react';
import { emailTemplatesApi } from '@/services/emailTemplates';
import type { MergeTagGroup } from '@/services/emailTemplates';

// =============================================================================
// STYLED COMPONENTS
// =============================================================================

const PopoverTriggerButton = styled.button`
    background: #f1f3f5;
    border: 1px solid #dee2e6;
    color: #495057;
    padding: 0 8px;
    height: 36px;
    border-radius: 6px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    flex-shrink: 0;

    &:hover:not(:disabled) {
        background: #e9ecef;
    }

    &:disabled {
        cursor: not-allowed;
        opacity: 0.6;
    }
`;

const PopoverContent = styled(Popover.Content)`
    background: white;
    border-radius: 8px;
    box-shadow: 0 10px 38px -10px rgba(22, 23, 24, 0.35), 0 10px 20px -15px rgba(22, 23, 24, 0.2);
    padding: 12px;
    width: 300px;
    max-height: 400px;
    overflow-y: auto;
    /* Acima do editor de e-mail fullscreen (Radix Dialog usa z-index 10001).
       Sem isto, o popover abre atrás do editor e parece que "nada acontece". */
    z-index: 10010;

    &:focus {
        outline: none;
    }
`;

const LoadingContainer = styled.div`
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    color: #6c757d;
    gap: 8px;

    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }

    svg {
        animation: spin 1s linear infinite;
    }
`;

const GroupTitle = styled.h4`
    font-size: 12px;
    font-weight: 600;
    color: #868e96;
    text-transform: uppercase;
    margin: 12px 0 8px 0;
    padding-bottom: 4px;
    border-bottom: 1px solid #f1f3f5;

    &:first-child {
        margin-top: 0;
    }
`;

const TagButton = styled.button`
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    padding: 8px 10px;
    border: none;
    background: transparent;
    border-radius: 4px;
    text-align: left;
    cursor: pointer;
    font-size: 14px;
    transition: background-color 0.15s ease-in-out;

    &:hover {
        background-color: #f8f9fa;
    }

    &:focus {
        outline: 2px solid #007bff;
        outline-offset: 2px;
    }
`;

const TagLabel = styled.span`
    color: #212529;
`;

const TagValue = styled.code`
    font-size: 12px;
    color: #495057;
    background: #e9ecef;
    padding: 2px 6px;
    border-radius: 3px;
`;

// =============================================================================
// INTERFACES
// =============================================================================

interface MergeTagPickerProps {
    onSelect: (tag: string) => void;
    children?: ReactNode;
}

// =============================================================================
// COMPONENTE
// =============================================================================

export const MergeTagPicker = ({ onSelect, children }: MergeTagPickerProps) => {
    const [tagGroups, setTagGroups] = useState<MergeTagGroup[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        // Busca as tags apenas quando o popover é aberto pela primeira vez
        if (isOpen && tagGroups.length === 0) {
            setIsLoading(true);
            emailTemplatesApi.getMergeTags()
                .then(data => {
                    setTagGroups(data);
                })
                .catch(error => {
                    console.error("Falha ao buscar merge tags:", error);
                })
                .finally(() => {
                    setIsLoading(false);
                });
        }
    }, [isOpen, tagGroups.length]);

    const handleTagSelect = (tag: string) => {
        onSelect(tag);
        setIsOpen(false);
    };

    return (
        <Popover.Root open={isOpen} onOpenChange={setIsOpen}>
            <Popover.Trigger asChild>
                {children ? (
                    children
                ) : (
                    <PopoverTriggerButton
                        title="Inserir variável"
                        aria-label="Abrir seletor de merge tags"
                    >
                        <Tag size={18} />
                    </PopoverTriggerButton>
                )}
            </Popover.Trigger>
            <Popover.Portal>
                <PopoverContent
                    sideOffset={5}
                    align="start"
                    role="dialog"
                    aria-label="Seletor de merge tags"
                >
                    {isLoading ? (
                        <LoadingContainer>
                            <Spinner size={16} />
                            Carregando...
                        </LoadingContainer>
                    ) : (
                        tagGroups.map((group) => (
                            <div key={group.label}>
                                <GroupTitle>{group.label}</GroupTitle>
                                {group.tags.map((tag) => (
                                    <Popover.Close asChild key={tag.value}>
                                        <TagButton
                                            onClick={() => handleTagSelect(tag.value)}
                                            aria-label={`Inserir ${tag.label}: ${tag.value}`}
                                        >
                                            <TagLabel>{tag.label}</TagLabel>
                                            <TagValue>{tag.value}</TagValue>
                                        </TagButton>
                                    </Popover.Close>
                                ))}
                            </div>
                        ))
                    )}
                </PopoverContent>
            </Popover.Portal>
        </Popover.Root>
    );
};