import React, { useState, useEffect } from 'react';
import { Palette, TextT, ArrowsHorizontal, Lightbulb, Sliders } from 'phosphor-react';
import type { GlobalEmailSettings } from '../types';
import { FONT_FAMILY_GROUPS } from '../constants';
import {
    StyleSection,
    StyleSectionTitle,
    StyleGrid,
    StyleRow,
    ColorPicker,
    Select,
    Label
} from '../styles';
import { tokens } from '../styles/tokens';

interface GlobalDesignPanelProps {
    settings: GlobalEmailSettings;
    onUpdate: (settings: GlobalEmailSettings) => void;
}

export const GlobalDesignPanel: React.FC<GlobalDesignPanelProps> = ({ settings, onUpdate }) => {
    const [localSettings, setLocalSettings] = useState<GlobalEmailSettings>(settings);

    useEffect(() => {
        setLocalSettings(settings);
    }, [settings]);

    const handleChange = (property: keyof GlobalEmailSettings, value: string) => {
        const newSettings = { ...localSettings, [property]: value };
        setLocalSettings(newSettings);
        onUpdate(newSettings);
    };

    return (
        <div>
            <h3 style={{
                marginTop: 0,
                marginBottom: '6px',
                color: tokens.color.ink,
                fontSize: '15px',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
            }}>
                <Sliders size={18} color={tokens.color.accent} weight="bold" />
                Design do E-mail
            </h3>
            <p style={{
                margin: '0 0 18px',
                fontSize: '13px',
                color: tokens.color.muted,
                lineHeight: 1.5,
            }}>
                Selecione um bloco para editá-lo, ou ajuste aqui o estilo geral.
            </p>

            {/* Cores Globais */}
            <StyleSection>
                <StyleSectionTitle>
                    <Palette size={16} />
                    Cores do Email
                </StyleSectionTitle>
                <StyleGrid>
                    <StyleRow>
                        <Label>Cor Primária</Label>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <ColorPicker
                                type="color"
                                value={localSettings.primaryColor || '#007bff'}
                                onChange={(e) => handleChange('primaryColor', e.target.value)}
                            />
                            <span style={{ fontSize: '12px', color: '#666' }}>
                                {localSettings.primaryColor || '#007bff'}
                            </span>
                        </div>
                    </StyleRow>

                    <StyleRow>
                        <Label>Cor Secundária</Label>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <ColorPicker
                                type="color"
                                value={localSettings.secondaryColor || '#6c757d'}
                                onChange={(e) => handleChange('secondaryColor', e.target.value)}
                            />
                            <span style={{ fontSize: '12px', color: '#666' }}>
                                {localSettings.secondaryColor || '#6c757d'}
                            </span>
                        </div>
                    </StyleRow>
                </StyleGrid>

                <StyleGrid style={{ marginTop: '12px' }}>
                    <StyleRow>
                        <Label>Cor do Texto</Label>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <ColorPicker
                                type="color"
                                value={localSettings.textColor || '#333333'}
                                onChange={(e) => handleChange('textColor', e.target.value)}
                            />
                            <span style={{ fontSize: '12px', color: '#666' }}>
                                {localSettings.textColor || '#333333'}
                            </span>
                        </div>
                    </StyleRow>

                    <StyleRow>
                        <Label>Fundo do Email</Label>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <ColorPicker
                                type="color"
                                value={localSettings.backgroundColor || '#ffffff'}
                                onChange={(e) => handleChange('backgroundColor', e.target.value)}
                            />
                            <span style={{ fontSize: '12px', color: '#666' }}>
                                {localSettings.backgroundColor || '#ffffff'}
                            </span>
                        </div>
                    </StyleRow>
                </StyleGrid>
            </StyleSection>

            {/* Tipografia Global */}
            <StyleSection>
                <StyleSectionTitle>
                    <TextT size={16} />
                    Tipografia Global
                </StyleSectionTitle>
                <StyleRow>
                    <Label>Fonte Padrão</Label>
                    <Select
                        value={localSettings.fontFamily || 'Arial, sans-serif'}
                        onChange={(e) => handleChange('fontFamily', e.target.value)}
                    >
                        {FONT_FAMILY_GROUPS.map((group) => (
                            <optgroup key={group.group} label={group.group}>
                                {group.fonts.map((font) => (
                                    <option key={font.value} value={font.value}>
                                        {font.label}
                                    </option>
                                ))}
                            </optgroup>
                        ))}
                    </Select>
                </StyleRow>
            </StyleSection>

            {/* Layout */}
            <StyleSection>
                <StyleSectionTitle>
                    <ArrowsHorizontal size={16} />
                    Layout
                </StyleSectionTitle>
                <StyleRow>
                    <Label>Largura Máxima</Label>
                    <Select
                        value={localSettings.maxWidth || '600px'}
                        onChange={(e) => handleChange('maxWidth', e.target.value)}
                    >
                        <option value="500px">Estreito (500px)</option>
                        <option value="600px">Padrão (600px)</option>
                        <option value="700px">Largo (700px)</option>
                        <option value="800px">Extra Largo (800px)</option>
                    </Select>
                </StyleRow>
            </StyleSection>

            <div style={{
                marginTop: '16px',
                padding: '12px 14px',
                backgroundColor: tokens.color.accentSoft,
                border: `1px solid ${tokens.color.accentBorder}`,
                borderRadius: tokens.radius.lg,
                fontSize: '13px',
                lineHeight: 1.5,
                color: tokens.color.accentHover,
                display: 'flex',
                gap: '10px',
                alignItems: 'flex-start',
            }}>
                <Lightbulb size={18} weight="fill" style={{ flexShrink: 0, marginTop: '1px' }} />
                <span>
                    <strong>Dica:</strong> essas configurações afetam todo o e-mail.
                    Você pode sobrescrevê-las individualmente em cada bloco.
                </span>
            </div>
        </div>
    );
};