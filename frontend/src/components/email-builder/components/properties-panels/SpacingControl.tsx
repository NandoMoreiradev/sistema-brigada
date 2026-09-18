import React, { useState, useCallback } from 'react';
import styled from 'styled-components';
import { Link, LinkBreak } from 'phosphor-react';
import type { BlockStyle } from '../../types';

// =============================================================================
// HELPERS
// =============================================================================

function parseLegacyPadding(padding: string | undefined): { top: number; right: number; bottom: number; left: number } {
    if (!padding) return { top: 8, right: 8, bottom: 8, left: 8 };
    const parts = padding.replace(/px/g, '').trim().split(/\s+/).map(Number);
    if (parts.length === 1) return { top: parts[0], right: parts[0], bottom: parts[0], left: parts[0] };
    if (parts.length === 2) return { top: parts[0], right: parts[1], bottom: parts[0], left: parts[1] };
    if (parts.length === 4) return { top: parts[0], right: parts[1], bottom: parts[2], left: parts[3] };
    return { top: 8, right: 8, bottom: 8, left: 8 };
}

function parseLegacyMargin(margin: string | undefined): { top: number; bottom: number } {
    if (!margin) return { top: 16, bottom: 16 };
    const parts = margin.replace(/px/g, '').trim().split(/\s+/).map(Number);
    if (parts.length === 1) return { top: parts[0], bottom: parts[0] };
    if (parts.length >= 2) return { top: parts[0], bottom: parts[2] ?? parts[0] };
    return { top: 16, bottom: 16 };
}

export function resolvePadding(style: BlockStyle): { top: number; right: number; bottom: number; left: number } {
    const hasPerSide = style.paddingTop !== undefined || style.paddingRight !== undefined
        || style.paddingBottom !== undefined || style.paddingLeft !== undefined;
    if (hasPerSide) {
        const base = parseLegacyPadding(style.padding);
        return {
            top: style.paddingTop ?? base.top,
            right: style.paddingRight ?? base.right,
            bottom: style.paddingBottom ?? base.bottom,
            left: style.paddingLeft ?? base.left,
        };
    }
    return parseLegacyPadding(style.padding);
}

export function resolveMargin(style: BlockStyle): { top: number; bottom: number } {
    const hasPerSide = style.marginTop !== undefined || style.marginBottom !== undefined;
    if (hasPerSide) {
        const base = parseLegacyMargin(style.margin);
        return {
            top: style.marginTop ?? base.top,
            bottom: style.marginBottom ?? base.bottom,
        };
    }
    return parseLegacyMargin(style.margin);
}

// =============================================================================
// STYLED COMPONENTS
// =============================================================================

const Section = styled.div`
    margin-bottom: 12px;
`;

const SectionLabel = styled.p`
    font-size: 11px;
    font-weight: 600;
    color: #666;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin: 0 0 8px 0;
`;

const BoxModelGrid = styled.div`
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    grid-template-rows: auto auto auto;
    align-items: center;
    justify-items: center;
    gap: 4px;
`;

const SpacingInput = styled.input`
    width: 52px;
    padding: 5px 6px;
    border: 1px solid #ccc;
    border-radius: 4px;
    font-size: 13px;
    text-align: center;
    color: #333;
    background: #fff;
    transition: border-color 0.15s;

    &:focus {
        outline: none;
        border-color: #007bff;
        box-shadow: 0 0 0 2px rgba(0,123,255,0.15);
    }

    &::-webkit-inner-spin-button,
    &::-webkit-outer-spin-button {
        opacity: 1;
    }
`;

const UnitLabel = styled.span`
    font-size: 11px;
    color: #999;
    margin-left: 2px;
`;

const InputWithUnit = styled.div`
    display: flex;
    align-items: center;
`;

const CenterCell = styled.div`
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
`;

const LinkButton = styled.button<{ $linked: boolean }>`
    all: unset;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    cursor: pointer;
    color: ${({ $linked }) => ($linked ? '#007bff' : '#aaa')};
    background: ${({ $linked }) => ($linked ? 'rgba(0,123,255,0.08)' : 'transparent')};
    border: 1px solid ${({ $linked }) => ($linked ? '#007bff' : '#ddd')};
    transition: all 0.15s;

    &:hover {
        border-color: #007bff;
        color: #007bff;
    }
`;

const MarginRow = styled.div`
    display: flex;
    gap: 12px;
    align-items: flex-end;
`;

const MarginField = styled.div`
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex: 1;

    label {
        font-size: 11px;
        color: #666;
    }
`;

// =============================================================================
// COMPONENTE PRINCIPAL
// =============================================================================

interface SpacingControlProps {
    style: BlockStyle;
    onChange: (changes: Partial<BlockStyle>) => void;
}

export const SpacingControl: React.FC<SpacingControlProps> = ({ style, onChange }) => {
    const pad = resolvePadding(style);
    const mar = resolveMargin(style);

    const [linked, setLinked] = useState(
        pad.top === pad.right && pad.top === pad.bottom && pad.top === pad.left
    );

    const handlePadding = useCallback((side: 'top' | 'right' | 'bottom' | 'left', raw: string) => {
        const value = Math.max(0, parseInt(raw, 10) || 0);
        if (linked) {
            onChange({
                paddingTop: value,
                paddingRight: value,
                paddingBottom: value,
                paddingLeft: value,
            });
        } else {
            onChange({ [`padding${side.charAt(0).toUpperCase() + side.slice(1)}`]: value } as Partial<BlockStyle>);
        }
    }, [linked, onChange]);

    const handleMargin = useCallback((side: 'top' | 'bottom', raw: string) => {
        const value = Math.max(0, parseInt(raw, 10) || 0);
        onChange({ [`margin${side.charAt(0).toUpperCase() + side.slice(1)}`]: value } as Partial<BlockStyle>);
    }, [onChange]);

    return (
        <>
            <Section>
                <SectionLabel>Preenchimento interno (padding)</SectionLabel>
                <BoxModelGrid>
                    {/* Topo */}
                    <div />
                    <InputWithUnit>
                        <SpacingInput
                            type="number"
                            min={0}
                            max={200}
                            value={pad.top}
                            onChange={(e) => handlePadding('top', e.target.value)}
                            aria-label="Padding superior"
                            title="Padding superior"
                        />
                        <UnitLabel>px</UnitLabel>
                    </InputWithUnit>
                    <div />

                    {/* Linha do meio: esquerda | botão link | direita */}
                    <InputWithUnit>
                        <SpacingInput
                            type="number"
                            min={0}
                            max={200}
                            value={pad.left}
                            onChange={(e) => handlePadding('left', e.target.value)}
                            aria-label="Padding esquerdo"
                            title="Padding esquerdo"
                        />
                        <UnitLabel>px</UnitLabel>
                    </InputWithUnit>

                    <CenterCell>
                        <LinkButton
                            type="button"
                            $linked={linked}
                            onClick={() => setLinked((l) => !l)}
                            title={linked ? 'Desvincular lados' : 'Vincular todos os lados'}
                            aria-label={linked ? 'Desvincular lados' : 'Vincular todos os lados'}
                        >
                            {linked ? <Link size={13} weight="bold" /> : <LinkBreak size={13} />}
                        </LinkButton>
                    </CenterCell>

                    <InputWithUnit>
                        <SpacingInput
                            type="number"
                            min={0}
                            max={200}
                            value={pad.right}
                            onChange={(e) => handlePadding('right', e.target.value)}
                            aria-label="Padding direito"
                            title="Padding direito"
                        />
                        <UnitLabel>px</UnitLabel>
                    </InputWithUnit>

                    {/* Base */}
                    <div />
                    <InputWithUnit>
                        <SpacingInput
                            type="number"
                            min={0}
                            max={200}
                            value={pad.bottom}
                            onChange={(e) => handlePadding('bottom', e.target.value)}
                            aria-label="Padding inferior"
                            title="Padding inferior"
                        />
                        <UnitLabel>px</UnitLabel>
                    </InputWithUnit>
                    <div />
                </BoxModelGrid>
            </Section>

            <Section>
                <SectionLabel>Espaço externo (margem vertical)</SectionLabel>
                <MarginRow>
                    <MarginField>
                        <label htmlFor="margin-top">Acima</label>
                        <InputWithUnit>
                            <SpacingInput
                                id="margin-top"
                                type="number"
                                min={0}
                                max={200}
                                value={mar.top}
                                onChange={(e) => handleMargin('top', e.target.value)}
                                aria-label="Margem superior"
                            />
                            <UnitLabel>px</UnitLabel>
                        </InputWithUnit>
                    </MarginField>
                    <MarginField>
                        <label htmlFor="margin-bottom">Abaixo</label>
                        <InputWithUnit>
                            <SpacingInput
                                id="margin-bottom"
                                type="number"
                                min={0}
                                max={200}
                                value={mar.bottom}
                                onChange={(e) => handleMargin('bottom', e.target.value)}
                                aria-label="Margem inferior"
                            />
                            <UnitLabel>px</UnitLabel>
                        </InputWithUnit>
                    </MarginField>
                </MarginRow>
            </Section>
        </>
    );
};
