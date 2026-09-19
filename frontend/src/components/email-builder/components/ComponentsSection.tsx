import React from 'react';
import { CaretDown } from 'phosphor-react';
import { PALETTE_ITEMS, CATEGORY_META } from '../constants';
import { PaletteItem } from './PaletteItem';
import { PaletteGrid } from '../styles';
import { tokens } from '../styles/tokens';

interface ComponentsSectionProps {
    draggedItem: string | null;
}

export const ComponentsSection: React.FC<ComponentsSectionProps> = ({ draggedItem }) => {
    // Todas as categorias visíveis, mas colapsáveis individualmente.
    const [collapsed, setCollapsed] = React.useState<Record<string, boolean>>({});

    const categorizedItems = PALETTE_ITEMS.reduce((acc, item) => {
        (acc[item.category] ||= []).push(item);
        return acc;
    }, {} as Record<string, typeof PALETTE_ITEMS>);

    const toggle = (key: string) =>
        setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));

    return (
        <div role="region" aria-label="Componentes disponíveis">
            <p style={{
                margin: '0 0 16px',
                fontSize: '13px',
                color: tokens.color.muted,
                lineHeight: 1.5,
            }}>
                Arraste um bloco para o e-mail.
            </p>

            {CATEGORY_META.map(({ key, label, icon: CategoryIcon }) => {
                const items = categorizedItems[key];
                if (!items?.length) return null;
                const isCollapsed = !!collapsed[key];
                const panelId = `palette-panel-${key}`;

                return (
                    <div key={key} style={{ marginBottom: '20px' }}>
                        <button
                            type="button"
                            onClick={() => toggle(key)}
                            aria-expanded={!isCollapsed}
                            aria-controls={panelId}
                            style={{
                                all: 'unset',
                                boxSizing: 'border-box',
                                width: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                marginBottom: '10px',
                                cursor: 'pointer',
                                color: tokens.color.muted,
                            }}
                        >
                            <CategoryIcon size={15} />
                            <span style={{
                                fontSize: '11px',
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                letterSpacing: '0.04em',
                                flexGrow: 1,
                            }}>
                                {label}
                            </span>
                            <CaretDown
                                size={13}
                                style={{
                                    transition: 'transform 0.15s ease',
                                    transform: isCollapsed ? 'rotate(-90deg)' : 'none',
                                }}
                            />
                        </button>

                        {!isCollapsed && (
                            <div id={panelId}>
                                <PaletteGrid>
                                    {items.map((item) => (
                                        <PaletteItem
                                            key={item.id}
                                            type={item.id}
                                            name={item.name}
                                            icon={item.icon}
                                            isDragging={draggedItem === item.id}
                                        />
                                    ))}
                                </PaletteGrid>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};
