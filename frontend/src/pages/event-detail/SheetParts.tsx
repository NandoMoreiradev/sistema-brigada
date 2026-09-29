// frontend/src/pages/event-detail/SheetParts.tsx
//
// Cabeçalho e rodapé das folhas impressas/PNG: dizem DE QUE DIA E TURNO é a folha e QUANDO foi
// gerada — para uma cópia velha não circular sem ninguém perceber que a escala mudou.

import styled from 'styled-components';
import { STATE_COLOR } from './mapColors';
import { formatAppDate } from '@/utils/datetime';

const Header = styled.div`
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    gap: 1rem;
    padding: 0 0 6px;
    color: #000;
    background: #fff;

    h1 {
        margin: 0;
        font-size: 18px;
        line-height: 1.2;
    }

    p {
        margin: 2px 0 0;
        font-size: 12px;
        color: #495057;
    }

    .plan {
        display: inline-block;
        margin-top: 2px;
        padding: 1px 8px;
        border: 1.5px solid #000;
        border-radius: 999px;
        font-size: 13px;
    }

    .shift {
        font-size: 15px;
        font-weight: 700;
        text-align: right;
        white-space: nowrap;
    }
`;

const Footer = styled.div`
    display: flex;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 0.5rem 1rem;
    padding-top: 6px;
    font-size: 10.5px;
    color: #495057;
    background: #fff;

    .legend {
        display: flex;
        gap: 0.75rem;
        flex-wrap: wrap;
    }

    .dot {
        display: inline-block;
        width: 9px;
        height: 9px;
        border-radius: 50%;
        margin-right: 4px;
        vertical-align: -1px;
    }
`;

interface SheetHeaderProps {
    eventTitle: string;
    location?: string | null;
    /** "Dia 1 — sex 13/11" */
    dayLabel: string;
    /** "Manhã · 08:00–12:00" (ou "Todos os turnos") */
    shiftLabel: string;
    /** Nome da planta (só quando o evento tem mais de uma). */
    planName?: string | null;
}

export function SheetHeader({ eventTitle, location, dayLabel, shiftLabel, planName }: SheetHeaderProps) {
    return (
        <Header>
            <div>
                <h1>{eventTitle}</h1>
                {location && <p>{location}</p>}
            </div>
            <div className="shift">
                {dayLabel}
                <br />
                {shiftLabel}
                {planName && (
                    <>
                        <br />
                        <span className="plan">{planName}</span>
                    </>
                )}
            </div>
        </Header>
    );
}

export function SheetFooter({ showLegend = true }: { showLegend?: boolean }) {
    return (
        <Footer>
            {showLegend ? (
                <span className="legend">
                    <span><i className="dot" style={{ background: STATE_COLOR.full }} />completo</span>
                    <span><i className="dot" style={{ background: STATE_COLOR.partial }} />parcial</span>
                    <span><i className="dot" style={{ background: STATE_COLOR.empty }} />sem ninguém</span>
                    <span>* aguardando confirmação</span>
                </span>
            ) : (
                <span />
            )}
            <span>Escala gerada em {formatAppDate(new Date().toISOString(), 'dd/MM/yyyy HH:mm')} — confira sempre a versão mais recente no sistema.</span>
        </Footer>
    );
}
