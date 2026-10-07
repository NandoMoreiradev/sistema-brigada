// frontend/src/pages/certificates/editor/fields.tsx
//
// Campos do painel de propriedades do editor.

import { useEffect, useState, type ReactNode } from 'react';
import styled from 'styled-components';
import { Check } from 'lucide-react';
import { THEME_COLORS, type CertificateLayout, type ColorValue } from '../layout/types';
import { mmToPt, ptToMm, resolveColor } from './layoutUtils';

export const PanelSection = styled.section`
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    padding: 0.85rem 1rem;
    border-bottom: 1px solid ${({ theme }) => theme.colors.borderLight};

    h4 {
        margin: 0;
        font-size: 0.7rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: ${({ theme }) => theme.colors.textMuted};
    }
`;

export const Row = styled.div<{ $cols?: number }>`
    display: grid;
    grid-template-columns: repeat(${({ $cols = 2 }) => $cols}, minmax(0, 1fr));
    gap: 0.5rem;
`;

const FieldLabel = styled.label`
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    font-size: 0.72rem;
    font-weight: 600;
    color: ${({ theme }) => theme.colors.textMedium};
    min-width: 0;

    input,
    select,
    textarea {
        width: 100%;
        box-sizing: border-box;
        padding: 0.35rem 0.45rem;
        border: 1px solid ${({ theme }) => theme.colors.border};
        border-radius: 6px;
        font-size: 0.8125rem;
        font-family: inherit;
        color: ${({ theme }) => theme.colors.textDark};
        background: ${({ theme }) => theme.colors.white};
    }

    textarea {
        resize: vertical;
        line-height: 1.4;
    }
`;

export function Field({ label, children }: { label: string; children: ReactNode }) {
    return (
        <FieldLabel>
            {label}
            {children}
        </FieldLabel>
    );
}

/**
 * Número que só vale ao sair do campo ou apertar Enter — digitar "1" a caminho de
 * "120" não pode mover o elemento para 1 nem criar um passo de desfazer por tecla.
 */
export function NumberInput({
    value,
    onCommit,
    min,
    max,
    step = 1,
    suffix,
}: {
    value: number;
    onCommit: (value: number) => void;
    min?: number;
    max?: number;
    step?: number;
    suffix?: string;
}) {
    const [draft, setDraft] = useState(String(value));
    useEffect(() => setDraft(String(value)), [value]);

    const commit = () => {
        const parsed = Number(draft.replace(',', '.'));
        if (draft.trim() === '' || !Number.isFinite(parsed)) {
            setDraft(String(value));
            return;
        }
        const clamped = Math.min(max ?? Infinity, Math.max(min ?? -Infinity, parsed));
        if (clamped !== value) onCommit(clamped);
        setDraft(String(clamped));
    };

    return (
        <div style={{ position: 'relative' }}>
            <input
                type="text"
                inputMode="decimal"
                value={draft}
                step={step}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commit}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                    if (e.key === 'Escape') setDraft(String(value));
                }}
                style={suffix ? { paddingRight: '1.9rem' } : undefined}
            />
            {suffix && <span style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', fontSize: '0.7rem', color: '#94a3b8', pointerEvents: 'none' }}>{suffix}</span>}
        </div>
    );
}

/** Mesmo NumberInput, mostrando milímetros e guardando pontos. */
export function MmInput({ pt, onCommit, min }: { pt: number; onCommit: (pt: number) => void; min?: number }) {
    return <NumberInput value={ptToMm(pt)} onCommit={(mm) => onCommit(mmToPt(mm))} min={min} step={0.5} suffix="mm" />;
}

const Swatches = styled.div`
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
    align-items: center;
`;

const Swatch = styled.button<{ $color: string; $active: boolean }>`
    width: 1.5rem;
    height: 1.5rem;
    border-radius: 6px;
    border: 2px solid ${({ $active }) => ($active ? '#2563eb' : 'rgba(15, 23, 42, 0.15)')};
    background: ${({ $color }) => $color};
    cursor: pointer;
    padding: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: #fff;
`;

const NoneSwatch = styled(Swatch)`
    background: linear-gradient(135deg, #fff 45%, #ef4444 45%, #ef4444 55%, #fff 55%);
`;

/**
 * Cor do elemento: uma das cores do tema (fica ligada a ele — mudar o tema muda o
 * elemento) ou uma cor própria.
 */
export function ColorField({
    label,
    value,
    layout,
    onChange,
    allowNone,
}: {
    label: string;
    value: ColorValue | null | undefined;
    layout: CertificateLayout;
    onChange: (value: ColorValue | null) => void;
    allowNone?: boolean;
}) {
    const isTheme = !!value?.startsWith('$');
    const resolved = resolveColor(value, layout);
    return (
        <Field label={label}>
            <Swatches>
                {allowNone && (
                    <NoneSwatch type="button" $color="#fff" $active={!value} title="Sem cor" aria-label="Sem cor" onClick={() => onChange(null)} />
                )}
                {THEME_COLORS.map(({ key, label: themeLabel }) => (
                    <Swatch
                        key={key}
                        type="button"
                        $color={layout.theme[key]}
                        $active={value === `$${key}`}
                        title={`Tema: ${themeLabel}`}
                        aria-label={`Cor do tema: ${themeLabel}`}
                        onClick={() => onChange(`$${key}`)}
                    >
                        {value === `$${key}` && <Check size={12} strokeWidth={3} style={{ mixBlendMode: 'difference' }} />}
                    </Swatch>
                ))}
                <input
                    type="color"
                    title="Cor própria"
                    aria-label={`${label}: cor própria`}
                    value={resolved && !isTheme ? resolved : resolved ?? '#000000'}
                    onChange={(e) => onChange(e.target.value.toUpperCase())}
                    style={{ width: '1.9rem', height: '1.6rem', padding: 0, border: !isTheme && value ? '2px solid #2563eb' : '1px solid #cbd5e1', borderRadius: 6, cursor: 'pointer' }}
                />
            </Swatches>
        </Field>
    );
}

const ToggleGroup = styled.div`
    display: inline-flex;
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: 6px;
    overflow: hidden;
    width: fit-content;
`;

const ToggleButton = styled.button<{ $active: boolean }>`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 2rem;
    height: 1.9rem;
    padding: 0 0.45rem;
    border: none;
    background: ${({ $active, theme }) => ($active ? theme.colors.primaryLight : theme.colors.white)};
    color: ${({ $active, theme }) => ($active ? theme.colors.primary : theme.colors.textMedium)};
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;

    & + & {
        border-left: 1px solid ${({ theme }) => theme.colors.border};
    }
`;

export function Toggles<T extends string>({
    value,
    options,
    onChange,
    ariaLabel,
}: {
    value: T;
    options: Array<{ value: T; label: ReactNode; title: string }>;
    onChange: (value: T) => void;
    ariaLabel: string;
}) {
    return (
        <ToggleGroup role="radiogroup" aria-label={ariaLabel}>
            {options.map((option) => (
                <ToggleButton
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={value === option.value}
                    title={option.title}
                    $active={value === option.value}
                    onClick={() => onChange(option.value)}
                >
                    {option.label}
                </ToggleButton>
            ))}
        </ToggleGroup>
    );
}

export function FlagButton({ active, onClick, title, children }: { active: boolean; onClick: () => void; title: string; children: ReactNode }) {
    return (
        <ToggleGroup>
            <ToggleButton type="button" $active={active} title={title} aria-label={title} aria-pressed={active} onClick={onClick}>
                {children}
            </ToggleButton>
        </ToggleGroup>
    );
}

export const Check2 = styled.label`
    display: flex;
    align-items: center;
    gap: 0.45rem;
    font-size: 0.8rem;
    color: ${({ theme }) => theme.colors.textDark};
    cursor: pointer;
`;
