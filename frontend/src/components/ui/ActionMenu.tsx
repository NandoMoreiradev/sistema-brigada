// frontend/src/components/ui/ActionMenu.tsx
//
// Menu de ações (Radix DropdownMenu): agrupa ações secundárias atrás de UM botão para a barra não
// ficar cheia (Exportar ▾, ⋯). Acessível por teclado e por toque. Suporta itens comuns, itens
// marcáveis (opções de exibição) e separadores.

import type { ReactNode } from 'react';
import * as Menu from '@radix-ui/react-dropdown-menu';
import styled from 'styled-components';
import { Check, MoreHorizontal } from 'lucide-react';
import { Button } from './Button';

export type MenuEntry =
    | { type?: 'item'; label: string; icon?: ReactNode; onSelect: () => void; danger?: boolean; disabled?: boolean; hint?: string }
    | { type: 'check'; label: string; checked: boolean; onCheckedChange: (checked: boolean) => void; disabled?: boolean }
    | { type: 'label'; label: string }
    | { type: 'separator' };

const Content = styled(Menu.Content)`
    min-width: 230px;
    max-width: 320px;
    padding: 0.3rem;
    background: ${({ theme }) => theme.colors.white};
    border: 1px solid ${({ theme }) => theme.colors.borderLight};
    border-radius: ${({ theme }) => theme.radii.md};
    box-shadow: ${({ theme }) => theme.shadows.e2};
    z-index: 200;
`;

const itemStyles = `
    display: flex;
    align-items: center;
    gap: 0.55rem;
    padding: 0.55rem 0.7rem;
    border-radius: 6px;
    font-size: 0.8125rem;
    cursor: pointer;
    outline: none;
    user-select: none;
`;

const Item = styled(Menu.Item)<{ $danger?: boolean }>`
    ${itemStyles}
    color: ${({ theme, $danger }) => ($danger ? theme.colors.danger : theme.colors.textDark)};

    &[data-highlighted] {
        background: ${({ theme, $danger }) => ($danger ? '#fff5f5' : theme.colors.lightGray)};
    }

    &[data-disabled] {
        opacity: 0.45;
        cursor: not-allowed;
    }

    small {
        margin-left: auto;
        color: ${({ theme }) => theme.colors.textMuted};
        font-size: 0.7rem;
    }
`;

const CheckItem = styled(Menu.CheckboxItem)`
    ${itemStyles}
    color: ${({ theme }) => theme.colors.textDark};

    &[data-highlighted] {
        background: ${({ theme }) => theme.colors.lightGray};
    }

    &[data-disabled] {
        opacity: 0.45;
        cursor: not-allowed;
    }

    .box {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 16px;
        height: 16px;
        border-radius: 4px;
        border: 1.5px solid ${({ theme }) => theme.colors.border};
        color: #fff;
    }

    &[data-state='checked'] .box {
        background: ${({ theme }) => theme.colors.primary};
        border-color: ${({ theme }) => theme.colors.primary};
    }
`;

const Heading = styled(Menu.Label)`
    padding: 0.4rem 0.7rem 0.2rem;
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    color: ${({ theme }) => theme.colors.textMuted};
`;

const Separator = styled(Menu.Separator)`
    height: 1px;
    margin: 0.3rem 0;
    background: ${({ theme }) => theme.colors.borderLight};
`;

interface ActionMenuProps {
    /** Elemento que abre o menu (um <Button>). */
    trigger: ReactNode;
    entries: MenuEntry[];
    align?: 'start' | 'center' | 'end';
}

export function ActionMenu({ trigger, entries, align = 'end' }: ActionMenuProps) {
    return (
        <Menu.Root modal={false}>
            <Menu.Trigger asChild>{trigger}</Menu.Trigger>
            <Menu.Portal>
                <Content align={align} sideOffset={6}>
                    {entries.map((entry, index) => {
                        if (entry.type === 'separator') return <Separator key={index} />;
                        if (entry.type === 'label') return <Heading key={index}>{entry.label}</Heading>;
                        if (entry.type === 'check') {
                            return (
                                <CheckItem
                                    key={index}
                                    checked={entry.checked}
                                    disabled={entry.disabled}
                                    // Mantém o menu aberto para alternar mais de uma opção.
                                    onSelect={(e) => e.preventDefault()}
                                    onCheckedChange={entry.onCheckedChange}
                                >
                                    <span className="box"><Menu.ItemIndicator><Check size={12} strokeWidth={3} /></Menu.ItemIndicator></span>
                                    {entry.label}
                                </CheckItem>
                            );
                        }
                        return (
                            <Item key={index} $danger={entry.danger} disabled={entry.disabled} onSelect={entry.onSelect}>
                                {entry.icon}
                                {entry.label}
                                {entry.hint && <small>{entry.hint}</small>}
                            </Item>
                        );
                    })}
                </Content>
            </Menu.Portal>
        </Menu.Root>
    );
}

/** Botão "⋯" padrão para abrir um ActionMenu (ação por linha, configuração...). */
export function MoreButton({ label = 'Mais ações', ...rest }: { label?: string } & React.ComponentProps<typeof Button>) {
    return (
        <Button $variant="ghost" aria-label={label} title={label} {...rest}>
            <MoreHorizontal size={18} />
        </Button>
    );
}
