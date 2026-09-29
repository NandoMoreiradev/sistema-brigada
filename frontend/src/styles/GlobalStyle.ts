// src/styles/GlobalStyle.ts
import { createGlobalStyle } from 'styled-components';
import { theme } from './theme';

export const GlobalStyle = createGlobalStyle`
    * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
    }

    html, body, #root {
        height: 100%;
        width: 100%;
        overflow-x: hidden;
    }

    body {
        font-family: ${theme.fonts.main};
        font-weight: 400;
        background-color: ${theme.colors.pageBackground};
        color: ${theme.colors.text};
        -webkit-font-smoothing: antialiased;
    }

    h1, h2, h3, h4, h5, h6 {
        font-family: ${theme.fonts.main};
        font-weight: 700;
        color: ${({ theme }) => theme.colors.textDark};
    }

    button, input, select, textarea {
        font-family: ${theme.fonts.main};
    }

    @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
    }

    .animate-spin {
        animation: spin 1s linear infinite;
    }

    @keyframes fadeIn {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
    }

    .animate-fade-in {
        animation: fadeIn 0.3s ease-out;
    }

    @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
    }

    .animate-pulse {
        animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
    }

    /* Impressão de escala/mapas (pages/event-detail/PrintPortal.tsx): imprime só o conteúdo do
       portal, sem o resto do layout (nav, abas, botões). O portal fica anexado direto ao body e só
       aparece na impressão quando body.is-printing está ativo. */
    #print-portal {
        display: none;
    }

    @media print {
        body.is-printing > #root {
            display: none !important;
        }

        body.is-printing #print-portal {
            display: block !important;
        }

        body.is-printing {
            background: #fff !important;
        }
    }
`;
