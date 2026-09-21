// frontend/src/components/ui/RichTextViewer.tsx
// Renderiza HTML salvo pelo RichTextEditor com segurança (mesma sanitização
// já usada pelo email-builder, frontend/src/utils/sanitize.ts).

import styled from 'styled-components';
import { sanitizeHtml } from '@/utils/sanitize';

const Content = styled.div`
    font-size: 0.875rem;
    line-height: 1.5;
    color: ${({ theme }) => theme.colors.textDark};

    p {
        margin: 0 0 0.5em;
    }
    ul,
    ol {
        margin: 0 0 0.5em;
        padding-left: 1.25rem;
    }
    a {
        color: ${({ theme }) => theme.colors.primary};
    }
`;

export function RichTextViewer({ html }: { html: string }) {
    return <Content dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }} />;
}
