// frontend/src/shared/builderTokens.ts
//
// Design tokens compartilhados pelos editores visuais (e-mail e landing pages).
// Fonte única da paleta refinada (neutros slate + azul de acento único),
// substituindo os hexes legados espalhados (#007BFF do Bootstrap, etc.).

export const tokens = {
    color: {
        // Acento (ações primárias, seleção, foco) — ÚNICO azul do sistema
        accent: '#2563EB',        // blue-600
        accentHover: '#1D4ED8',   // blue-700
        accentSoft: '#EFF6FF',    // blue-50
        accentBorder: '#BFDBFE',  // blue-200

        // Neutros (texto e superfícies claras)
        ink: '#0F172A',           // slate-900 — títulos
        text: '#1E293B',          // slate-800 — corpo
        muted: '#64748B',         // slate-500 — secundário
        faint: '#94A3B8',         // slate-400 — placeholders/ícones sutis
        line: '#E2E8F0',          // slate-200 — bordas
        lineSoft: '#F1F5F9',      // slate-100 — divisórias suaves
        surface: '#FFFFFF',       // painéis
        surfaceAlt: '#F8FAFC',    // slate-50 — seções internas
        canvas: '#F1F5F9',        // fundo do palco/canvas

        // Semânticas
        success: '#16A34A',
        successHover: '#15803D',
        danger: '#DC2626',
        dangerSoft: '#FEF2F2',
        warning: '#D97706',
    },

    // Escala "chrome" escura — barras/painéis do editor de landing pages.
    // Unifica os dois tons de dark que existiam (#0f1117 e #1a1a2e/#16213e).
    chrome: {
        bg: '#0F1117',                       // superfície escura base (header/toolbar)
        bgAlt: '#161826',                    // painel escuro um pouco mais claro
        bgSoft: '#1B1E2B',                   // hover/realce de superfície escura
        border: '#252A3A',                   // bordas no escuro
        borderSoft: 'rgba(255,255,255,0.10)',
        text: 'rgba(255,255,255,0.90)',      // texto principal no escuro
        textMuted: 'rgba(255,255,255,0.58)', // texto secundário
        textFaint: 'rgba(255,255,255,0.38)', // ícones/desabilitado
        hover: 'rgba(255,255,255,0.08)',
        hoverStrong: 'rgba(255,255,255,0.16)',
        divider: 'rgba(255,255,255,0.12)',
        // Semânticas legíveis sobre fundo escuro
        accent: '#3B82F6',                   // blue-500 (mais claro p/ contraste no dark)
        success: '#4ADE80',
        warning: '#FBBF24',
        scheduled: '#A78BFA',
        danger: '#F87171',
    },

    radius: {
        sm: '6px',
        md: '8px',
        lg: '12px',
        xl: '16px',
        pill: '999px',
    },

    shadow: {
        xs: '0 1px 2px rgba(15, 23, 42, 0.06)',
        sm: '0 1px 3px rgba(15, 23, 42, 0.08), 0 1px 2px rgba(15, 23, 42, 0.04)',
        md: '0 4px 12px rgba(15, 23, 42, 0.08)',
        lg: '0 12px 32px rgba(15, 23, 42, 0.12)',
        focus: '0 0 0 3px rgba(37, 99, 235, 0.15)',
    },

    space: {
        xs: '4px',
        sm: '8px',
        md: '12px',
        lg: '16px',
        xl: '24px',
    },

    font: {
        ui: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    },
};

export type Tokens = typeof tokens;
