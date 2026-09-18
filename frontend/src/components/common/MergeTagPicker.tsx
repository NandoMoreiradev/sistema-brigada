// frontend/src/components/common/MergeTagPicker.tsx

import React, { useState } from 'react';
import styled from 'styled-components';
import * as Popover from '@radix-ui/react-popover';
import * as Tooltip from '@radix-ui/react-tooltip';
import { Spinner } from 'phosphor-react';
// ✅ Fonte única de verdade: mesmo endpoint usado pelo Construtor de E-mails
// (backend/src/constants/merge-tags.constant.ts), evitando listas duplicadas
// que podem ficar dessincronizadas.
import { emailTemplatesApi } from '../../services/emailTemplates';
import type { MergeTagGroup } from '../../services/emailTemplates';

/**
 * ============================================================================
 * MERGE TAG PICKER - Seletor Visual de Variáveis
 * ============================================================================
 * Componente usado no BubbleMenu do RichTextEditor
 * Permite selecionar merge tags clicando visualmente usando Radix UI
 * ============================================================================
 */

interface MergeTagPickerProps {
    onSelect: (tagKey: string) => void;
    children: React.ReactNode;
}

export const MergeTagPicker: React.FC<MergeTagPickerProps> = ({ onSelect, children }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [tagGroups, setTagGroups] = useState<MergeTagGroup[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const handleOpenChange = (open: boolean) => {
        setIsOpen(open);
        if (open && tagGroups.length === 0) {
            setIsLoading(true);
            emailTemplatesApi.getMergeTags()
                .then(setTagGroups)
                .catch((error) => console.error('Falha ao buscar merge tags:', error))
                .finally(() => setIsLoading(false));
        }
    };

    const handleTagSelect = (fullTagValue: string) => {
        // Extrai o nome da tag sem as chaves {{ }}
        // Ex: '{{lead.name}}' => 'lead.name'
        const tagKey = fullTagValue.match(/{{(.*?)}}/)?.[1] || fullTagValue;
        onSelect(tagKey);

        // Fecha o popover programaticamente
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    };

    return (
        <Tooltip.Provider delayDuration={300}>
            <Popover.Root open={isOpen} onOpenChange={handleOpenChange}>
                <Popover.Trigger asChild>{children}</Popover.Trigger>
                <Popover.Portal>
                    <PopoverContentStyled sideOffset={5}>
                        {isLoading ? (
                            <LoadingContainer>
                                <Spinner size={16} />
                                Carregando...
                            </LoadingContainer>
                        ) : (
                            <ScrollArea>
                                {tagGroups.map((group) => (
                                    <div key={group.label}>
                                        <GroupLabel>{group.label}</GroupLabel>
                                        {group.tags.map((tag) => (
                                            <Tooltip.Root key={tag.value}>
                                                <Tooltip.Trigger asChild>
                                                    <TagButton onClick={() => handleTagSelect(tag.value)}>
                                                        <span>{tag.label}</span>
                                                        <TagValue>{tag.value}</TagValue>
                                                    </TagButton>
                                                </Tooltip.Trigger>
                                                <Tooltip.Portal>
                                                    <TooltipContentStyled sideOffset={5}>
                                                        {tag.description}
                                                        <Tooltip.Arrow style={{ fill: '#343a40' }} />
                                                    </TooltipContentStyled>
                                                </Tooltip.Portal>
                                            </Tooltip.Root>
                                        ))}
                                    </div>
                                ))}
                            </ScrollArea>
                        )}
                        <PopoverArrowStyled />
                    </PopoverContentStyled>
                </Popover.Portal>
            </Popover.Root>
        </Tooltip.Provider>
    );
};

// --- Styled Components ---

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

const PopoverContentStyled = styled(Popover.Content)`
    background-color: white;
    border-radius: 8px;
    box-shadow: 0 10px 38px -10px rgba(22, 23, 24, 0.35), 0 10px 20px -15px rgba(22, 23, 24, 0.2);
    padding: 8px;
    width: 300px;
    z-index: 10001;

    @media (prefers-reduced-motion: no-preference) {
        animation-duration: 400ms;
        animation-timing-function: cubic-bezier(0.16, 1, 0.3, 1);
        will-change: transform, opacity;
        &[data-state='open'] {
            &[data-side='top'] { animation-name: slideDownAndFade; }
            &[data-side='right'] { animation-name: slideLeftAndFade; }
            &[data-side='bottom'] { animation-name: slideUpAndFade; }
            &[data-side='left'] { animation-name: slideRightAndFade; }
        }
    }

    @keyframes slideUpAndFade {
        from { opacity: 0; transform: translateY(2px); }
        to { opacity: 1; transform: translateY(0); }
    }
    @keyframes slideRightAndFade {
        from { opacity: 0; transform: translateX(-2px); }
        to { opacity: 1; transform: translateX(0); }
    }
    @keyframes slideDownAndFade {
        from { opacity: 0; transform: translateY(-2px); }
        to { opacity: 1; transform: translateY(0); }
    }
    @keyframes slideLeftAndFade {
        from { opacity: 0; transform: translateX(2px); }
        to { opacity: 1; transform: translateX(0); }
    }
`;

const PopoverArrowStyled = styled(Popover.Arrow)`
    fill: white;
`;

const ScrollArea = styled.div`
    max-height: 300px;
    overflow-y: auto;
    padding-right: 8px;

    /* Scrollbar customizada para melhor UX */
    &::-webkit-scrollbar {
        width: 6px;
    }

    &::-webkit-scrollbar-track {
        background: #f1f3f5;
        border-radius: 3px;
    }

    &::-webkit-scrollbar-thumb {
        background: #adb5bd;
        border-radius: 3px;

        &:hover {
            background: #868e96;
        }
    }
`;

const GroupLabel = styled.div`
    font-size: 11px;
    font-weight: 600;
    color: #6c757d;
    padding: 8px 12px 4px;
    text-transform: uppercase;
    letter-spacing: 0.5px;

    /* Melhora visual */
    &:not(:first-child) {
        margin-top: 8px;
        padding-top: 12px;
        border-top: 1px solid #e9ecef;
    }
`;

const TagButton = styled.button`
    width: 100%;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    border: none;
    background-color: transparent;
    border-radius: 6px;
    text-align: left;
    cursor: pointer;
    font-size: 14px;
    color: #343a40;
    transition: background-color 0.2s ease;

    &:hover {
        background-color: #f1f3f5;
    }

    &:active {
        background-color: #e9ecef;
    }

    /* Melhora a acessibilidade */
    &:focus-visible {
        outline: 2px solid #3b82f6;
        outline-offset: 2px;
    }
`;

const TagValue = styled.span`
    font-family: 'SF Mono', 'Fira Code', 'Fira Mono', 'Roboto Mono', monospace;
    font-size: 12px;
    color: #adb5bd;

    /* Destaque visual ao hover no botão pai */
    ${TagButton}:hover & {
        color: #3b82f6;
    }
`;

const TooltipContentStyled = styled(Tooltip.Content)`
    background-color: #343a40;
    color: white;
    border-radius: 6px;
    padding: 8px 12px;
    font-size: 12px;
    line-height: 1.5;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 10002;
    max-width: 250px;

    @media (prefers-reduced-motion: no-preference) {
        animation-duration: 400ms;
        animation-timing-function: cubic-bezier(0.16, 1, 0.3, 1);
        will-change: transform, opacity;
        &[data-state='delayed-open'] {
            animation-name: slideUpAndFade;
        }
    }

    @keyframes slideUpAndFade {
        from { opacity: 0; transform: translateY(2px); }
        to { opacity: 1; transform: translateY(0); }
    }
`;