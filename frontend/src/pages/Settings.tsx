// frontend/src/pages/Settings.tsx
//
// Central de configurações — shell com abas laterais. Antes desta tela virar
// um shell, era só o conteúdo hoje movido para settings/IntegrationsTab.tsx
// (só Google Calendar). As abas Perfil/Academia são novas: reúnem endpoints
// de backend que já existiam (auth.controller.ts / organizations.controller.ts)
// mas não tinham nenhuma UI ainda.

import * as Tabs from '@radix-ui/react-tabs';
import { useSearchParams } from 'react-router-dom';
import styled from 'styled-components';
import { Settings as SettingsIcon, UserRound, Calendar, Building2 } from 'lucide-react';
import { PageLayout } from '@/components/layout/PageLayout';
import { useAuth } from '@/contexts/AuthContext';
import { ProfileTab } from '@/pages/settings/ProfileTab';
import { IntegrationsTab } from '@/pages/settings/IntegrationsTab';
import { OrganizationTab } from '@/pages/settings/OrganizationTab';

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

// SUPER_ADMIN "puro" (sem academia própria) não vê a aba Academia — ver
// docs/decisoes.md. Um SUPER_ADMIN impersonando uma academia (ver
// AuthContext.startImpersonation) passa a ter role ORG_ADMIN de verdade
// nesse token, então cai neste caso normalmente.
const ORGANIZATION_TAB_ROLES = ['ORG_ADMIN', 'GROUP_ADMIN'];

export default function Settings() {
    const { user } = useAuth();
    const canEditOrganization = !!user?.role && ORGANIZATION_TAB_ROLES.includes(user.role);

    // Volta do redirect OAuth do Google (ver IntegrationsTab) precisa abrir
    // direto na aba Integrações, senão o toast de sucesso/erro aparece sobre a
    // aba Perfil sem contexto nenhum.
    const [searchParams] = useSearchParams();
    const initialTab = searchParams.has('success') || searchParams.has('error') ? 'integrations' : 'profile';

    return (
        <PageLayout title="Central de configurações" subtitle="Perfil, integrações e preferências" icon={<SettingsIcon size={16} />}>
            <Tabs.Root defaultValue={initialTab} orientation="vertical">
                <Shell>
                    <TabsList>
                        <TabsTrigger value="profile"><UserRound size={16} /> Perfil</TabsTrigger>
                        <TabsTrigger value="integrations"><Calendar size={16} /> Integrações</TabsTrigger>
                        {canEditOrganization && (
                            <TabsTrigger value="organization"><Building2 size={16} /> Academia</TabsTrigger>
                        )}
                    </TabsList>

                    <TabsContent value="profile"><ProfileTab /></TabsContent>
                    <TabsContent value="integrations"><IntegrationsTab /></TabsContent>
                    {canEditOrganization && (
                        <TabsContent value="organization"><OrganizationTab /></TabsContent>
                    )}
                </Shell>
            </Tabs.Root>
        </PageLayout>
    );
}
