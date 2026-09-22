// frontend/src/pages/admin/EmailsAndCommunications.tsx
//
// Shell com abas laterais (mesmo padrão de Settings.tsx) reunindo os dois recursos de e-mail:
// Modelos (templates dos 3 gatilhos automáticos, TemplatesTab.tsx) e Comunicados (e-mail
// avulso pra pessoas da academia, CommunicationsTab.tsx). Antes eram/seriam páginas
// separadas — moram juntas porque compartilham a mesma permissão (communications:manage) e o
// mesmo domínio ("e-mail que sai da academia").

import * as Tabs from '@radix-ui/react-tabs';
import { useSearchParams } from 'react-router-dom';
import styled from 'styled-components';
import { Mail, Send } from 'lucide-react';
import { PageLayout } from '@/components/layout/PageLayout';
import { TemplatesTab } from '@/pages/admin/emails/TemplatesTab';
import { CommunicationsTab } from '@/pages/admin/emails/CommunicationsTab';

const Shell = styled.div`
    display: flex;
    gap: 1.5rem;
    align-items: flex-start;
    height: 100%;
`;

const TabsList = styled(Tabs.List)`
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    width: 220px;
    flex-shrink: 0;
`;

const TabsTrigger = styled(Tabs.Trigger)`
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.6rem 0.75rem;
    border-radius: ${({ theme }) => theme.radii.sm};
    background: transparent;
    border: none;
    text-align: left;
    font-size: 0.875rem;
    font-weight: 600;
    color: ${({ theme }) => theme.colors.textMedium};
    cursor: pointer;

    &:hover {
        background: ${({ theme }) => theme.colors.lightGray};
    }

    &[data-state='active'] {
        background: ${({ theme }) => theme.colors.primaryLight};
        color: ${({ theme }) => theme.colors.primary};
    }
`;

const TabsContent = styled(Tabs.Content)`
    flex: 1;
    min-width: 0;
`;

export default function EmailsAndCommunications() {
    const [searchParams] = useSearchParams();
    const initialTab = searchParams.get('tab') === 'communications' ? 'communications' : 'templates';

    return (
        <PageLayout title="E-mails e comunicados" subtitle="Modelos de e-mail transacional e comunicados avulsos" icon={<Mail size={16} />}>
            <Tabs.Root defaultValue={initialTab} orientation="vertical">
                <Shell>
                    <TabsList>
                        <TabsTrigger value="templates"><Mail size={16} /> Modelos de e-mail</TabsTrigger>
                        <TabsTrigger value="communications"><Send size={16} /> Comunicados</TabsTrigger>
                    </TabsList>

                    <TabsContent value="templates"><TemplatesTab /></TabsContent>
                    <TabsContent value="communications"><CommunicationsTab /></TabsContent>
                </Shell>
            </Tabs.Root>
        </PageLayout>
    );
}
