// frontend/src/pages/settings/SettingsParts.tsx
//
// Peças visuais e utilitárias compartilhadas pelas abas da central de configurações: cartão com
// cabeçalho/rodapé, grade de formulário, linha de status, interruptor, zona de risco, esqueleto de
// carregamento e o aviso de "alterações não salvas" ao trocar de aba.

import { createContext, useContext, useEffect, type ReactNode } from 'react';
import styled, { css, keyframes } from 'styled-components';
import { Button } from '@/components/ui/Button';

/* ------------------------------------------------ cartão ------------------------------------------------ */

const CardRoot = styled.section`
    background: ${({ theme }) => theme.colors.white};
    border: 1px solid ${({ theme }) => theme.colors.borderLight};
    border-radius: ${({ theme }) => theme.radii.md};
    box-shadow: ${({ theme }) => theme.shadows.e1};
    overflow: hidden;
`;

const CardHead = styled.header`
    display: flex;
    align-items: flex-start;
    gap: 0.85rem;
    padding: 1rem 1.25rem;
    border-bottom: 1px solid ${({ theme }) => theme.colors.borderLight};
`;

export const IconTile = styled.span<{ $tone?: 'primary' | 'success' | 'neutral' }>`
    flex: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2.25rem;
    height: 2.25rem;
    border-radius: ${({ theme }) => theme.radii.sm};
    ${({ theme, $tone = 'primary' }) => {
        const map = {
            primary: { bg: theme.colors.primaryLight, fg: theme.colors.primary },
            success: { bg: '#e6f7ec', fg: theme.colors.success },
            neutral: { bg: theme.colors.backgroundMedium, fg: theme.colors.textMedium },
        } as const;
        return css`background: ${map[$tone].bg}; color: ${map[$tone].fg};`;
    }}
`;

const HeadText = styled.div`
    flex: 1;
    min-width: 0;

    h3 {
        margin: 0;
        font-size: 0.9375rem;
        font-weight: 700;
        color: ${({ theme }) => theme.colors.textDark};
    }

    p {
        margin: 0.15rem 0 0;
        font-size: 0.8125rem;
        color: ${({ theme }) => theme.colors.textMuted};
    }
`;

const CardBody = styled.div`
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
`;

const CardFoot = styled.footer`
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.75rem;
    padding: 0.75rem 1.25rem;
    background: ${({ theme }) => theme.colors.lightGray};
    border-top: 1px solid ${({ theme }) => theme.colors.borderLight};
`;

interface SettingsCardProps {
    icon: ReactNode;
    title: string;
    description?: string;
    /** À direita do título (ex.: badge de status). */
    aside?: ReactNode;
    tone?: 'primary' | 'success' | 'neutral';
    footer?: ReactNode;
    children?: ReactNode;
}

export function SettingsCard({ icon, title, description, aside, tone, footer, children }: SettingsCardProps) {
    return (
        <CardRoot>
            <CardHead>
                <IconTile $tone={tone}>{icon}</IconTile>
                <HeadText>
                    <h3>{title}</h3>
                    {description && <p>{description}</p>}
                </HeadText>
                {aside}
            </CardHead>
            {children && <CardBody>{children}</CardBody>}
            {footer && <CardFoot>{footer}</CardFoot>}
        </CardRoot>
    );
}

export const TabStack = styled.div`
    display: flex;
    flex-direction: column;
    gap: 1rem;
    max-width: 760px;
`;

/** Duas colunas quando cabe, uma em telas estreitas. */
export const FormGrid = styled.div`
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.875rem 1rem;

    @media (max-width: 640px) {
        grid-template-columns: 1fr;
    }
`;

export const FullRow = styled.div`
    grid-column: 1 / -1;
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
`;

/* ---------------------------------------- rodapé de salvar ---------------------------------------- */

const SavedNote = styled.span`
    margin-right: auto;
    font-size: 0.75rem;
    color: ${({ theme }) => theme.colors.textMuted};
`;

interface SaveFooterProps {
    isDirty: boolean;
    isPending: boolean;
    isSuccess?: boolean;
    label?: string;
    /** Sem `form`, o botão é type=submit do formulário que o contém; com ele, ligamos por id. */
    form?: string;
}

/** Botão só habilita com alteração; depois de salvar mostra "Alterações salvas". */
export function SaveFooter({ isDirty, isPending, isSuccess, label = 'Salvar', form }: SaveFooterProps) {
    return (
        <>
            <SavedNote aria-live="polite">
                {isDirty ? 'Você tem alterações não salvas.' : isSuccess ? 'Alterações salvas.' : ''}
            </SavedNote>
            <Button type="submit" form={form} disabled={!isDirty || isPending}>
                {isPending ? 'Salvando...' : label}
            </Button>
        </>
    );
}

/* -------------------------------------------- linha de status -------------------------------------------- */

export const StatusRow = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
`;

/* ------------------------------------------------ interruptor ------------------------------------------------ */

export const SwitchInput = styled.input.attrs({ type: 'checkbox', role: 'switch' })`
    appearance: none;
    -webkit-appearance: none;
    flex: none;
    position: relative;
    width: 2.5rem;
    height: 1.4rem;
    margin: 0;
    border-radius: 999px;
    background: #ced4da;
    cursor: pointer;
    transition: background 0.15s;

    &::after {
        content: '';
        position: absolute;
        top: 0.15rem;
        left: 0.15rem;
        width: 1.1rem;
        height: 1.1rem;
        border-radius: 50%;
        background: #fff;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.25);
        transition: transform 0.15s;
    }

    &:checked {
        background: ${({ theme }) => theme.colors.primary};
    }

    &:checked::after {
        transform: translateX(1.1rem);
    }

    &:focus-visible {
        outline: 2px solid ${({ theme }) => theme.colors.primary};
        outline-offset: 2px;
    }
`;

export const SwitchRow = styled.label`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    cursor: pointer;

    .text {
        display: flex;
        flex-direction: column;
        gap: 0.15rem;
    }

    strong {
        font-size: 0.875rem;
        color: ${({ theme }) => theme.colors.textDark};
    }

    span.hint {
        font-size: 0.75rem;
        color: ${({ theme }) => theme.colors.textMuted};
    }
`;

/* ------------------------------------------------ zona de risco ------------------------------------------------ */

export const DangerZone = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
    padding: 0.85rem 1rem;
    border: 1px solid #f5c2c0;
    background: #fff8f8;
    border-radius: ${({ theme }) => theme.radii.sm};

    strong {
        display: block;
        font-size: 0.8125rem;
        color: ${({ theme }) => theme.colors.danger};
    }

    span {
        font-size: 0.75rem;
        color: ${({ theme }) => theme.colors.textMuted};
    }
`;

/* ---------------------------------------------- esqueleto ---------------------------------------------- */

const shimmer = keyframes`
    0% { background-position: -200px 0; }
    100% { background-position: calc(200px + 100%) 0; }
`;

export const Skeleton = styled.div<{ $h?: string; $w?: string }>`
    height: ${({ $h = '1rem' }) => $h};
    width: ${({ $w = '100%' }) => $w};
    border-radius: 6px;
    background: linear-gradient(90deg, #eceff1 0px, #f6f8f9 100px, #eceff1 200px);
    background-size: 200px 100%;
    animation: ${shimmer} 1.2s infinite linear;
`;

export function CardSkeleton() {
    return (
        <CardRoot>
            <CardHead>
                <Skeleton $h="2.25rem" $w="2.25rem" />
                <HeadText><Skeleton $h="1rem" $w="40%" /></HeadText>
            </CardHead>
            <CardBody>
                <Skeleton $h="2.4rem" />
                <Skeleton $h="2.4rem" />
            </CardBody>
        </CardRoot>
    );
}

/* -------------------------------------- alterações não salvas -------------------------------------- */

export const DirtyContext = createContext<(dirty: boolean) => void>(() => {});

/** A aba avisa a central quando há alteração pendente, para confirmar antes de trocar de aba. */
export function useReportDirty(dirty: boolean) {
    const report = useContext(DirtyContext);
    useEffect(() => {
        report(dirty);
        return () => report(false);
    }, [dirty, report]);
}
