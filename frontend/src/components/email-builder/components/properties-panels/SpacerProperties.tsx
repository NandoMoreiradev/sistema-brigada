import React from 'react';
import styled from 'styled-components';
import { ArrowsOutLineVertical } from 'phosphor-react';

import type { ExtendedBlockProps } from '../../types';
import { Label, StyleSection, StyleSectionTitle } from '../../styles';

// =============================================================================
// STYLED COMPONENTS
// =============================================================================

const PresetGrid = styled.div`
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
    margin-bottom: 20px;
`;

const PresetButton = styled.button<{ $selected?: boolean }>`
    padding: 12px;
    border-radius: 8px;
    border: 2px solid ${props => props.$selected ? '#007bff' : '#dee2e6'};
    background: ${props => props.$selected ? '#e7f3ff' : 'white'};
    color: ${props => props.$selected ? '#007bff' : '#495057'};
    font-size: 13px;
    font-weight: ${props => props.$selected ? '600' : '500'};
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;

    &:hover {
        background: ${props => props.$selected ? '#e7f3ff' : '#f8f9fa'};
        border-color: #007bff;
        transform: translateY(-2px);
    }

    span {
        font-size: 11px;
        color: #6c757d;
    }
`;

const SliderContainer = styled.div`
    margin-bottom: 20px;
`;

const SliderRow = styled.div`
    display: flex;
    align-items: center;
    gap: 12px;
`;

const RangeInput = styled.input`
    width: 100%;
    cursor: pointer;
    accent-color: #007bff;
`;

const ValueDisplay = styled.div`
    font-size: 16px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    color: #007bff;
    min-width: 60px;
    text-align: right;
    background: #e7f3ff;
    padding: 8px 12px;
    border-radius: 6px;
`;

const SpacerPreview = styled.div<{ $height: string }>`
    margin-top: 16px;
    border: 2px dashed #007bff;
    border-radius: 8px;
    background: linear-gradient(to bottom, #e7f3ff 0%, #f8f9fa 100%);
    height: ${props => props.$height};
    display: flex;
    align-items: center;
    justify-content: center;
    color: #007bff;
    font-size: 13px;
    font-weight: 500;
    transition: height 0.3s ease;
`;

const InfoBox = styled.div`
    background-color: #fff3cd;
    border: 1px solid #ffeaa7;
    border-radius: 6px;
    padding: 10px 12px;
    margin-top: 16px;
    font-size: 12px;
    color: #856404;
    line-height: 1.5;
`;

// =============================================================================
// PRESETS
// =============================================================================

const SPACER_PRESETS = [
    { label: 'Extra Pequeno', value: '10px', desc: '10px' },
    { label: 'Pequeno', value: '20px', desc: '20px' },
    { label: 'Médio', value: '40px', desc: '40px' },
    { label: 'Grande', value: '60px', desc: '60px' },
    { label: 'Extra Grande', value: '80px', desc: '80px' },
    { label: 'Enorme', value: '120px', desc: '120px' },
];

// =============================================================================
// INTERFACE
// =============================================================================

interface SpacerPropertiesProps {
    props: ExtendedBlockProps;
    onPropsChange: (newProps: ExtendedBlockProps) => void;
}

// =============================================================================
// COMPONENTE
// =============================================================================

export const SpacerProperties: React.FC<SpacerPropertiesProps> = ({ props, onPropsChange }) => {
    const currentHeight = typeof props.spacerHeight === 'string' ? props.spacerHeight : '40px';
    const currentHeightNum = parseInt(currentHeight);

    const handlePresetClick = (value: string) => {
        onPropsChange({ ...props, spacerHeight: value });
    };

    const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = `${e.target.value}px`;
        onPropsChange({ ...props, spacerHeight: value });
    };

    return (
        <>
            <StyleSection>
                <StyleSectionTitle>
                    <ArrowsOutLineVertical size={16} />
                    Altura do Espaçador
                </StyleSectionTitle>

                <Label style={{ marginBottom: '12px' }}>Presets Rápidos</Label>
                <PresetGrid>
                    {SPACER_PRESETS.map(preset => (
                        <PresetButton
                            key={preset.value}
                            $selected={currentHeight === preset.value}
                            onClick={() => handlePresetClick(preset.value)}
                            type="button"
                            title={`Definir altura como ${preset.value}`}
                        >
                            {preset.label}
                            <span>{preset.desc}</span>
                        </PresetButton>
                    ))}
                </PresetGrid>

                <Label style={{ marginBottom: '8px' }}>Ajuste Personalizado</Label>
                <SliderContainer>
                    <SliderRow>
                        <RangeInput
                            type="range"
                            min="5"
                            max="200"
                            step="5"
                            value={currentHeightNum}
                            onChange={handleSliderChange}
                            aria-label="Ajustar altura do espaçador"
                        />
                        <ValueDisplay>{currentHeightNum}px</ValueDisplay>
                    </SliderRow>
                </SliderContainer>

                <Label style={{ marginBottom: '8px' }}>Pré-visualização</Label>
                <SpacerPreview $height={currentHeight}>
                    <ArrowsOutLineVertical size={20} weight="bold" />
                    {currentHeight}
                </SpacerPreview>

                <InfoBox>
                    💡 <strong>Dica:</strong> Use espaçadores para criar separação visual entre seções do seu e-mail. Espaçadores maiores (60px+) são ideais para separar conteúdos importantes.
                </InfoBox>
            </StyleSection>
        </>
    );
};
