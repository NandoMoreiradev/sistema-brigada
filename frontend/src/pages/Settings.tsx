// frontend/src/pages/Settings.tsx
//
// "Minha Conta": cabeçalho de perfil + menu lateral agrupado (Minha conta / Academia). O grupo
// Academia só aparece para ORG_ADMIN/GROUP_ADMIN. A aba ativa vive em `?tab=` para poder linkar
// direto numa seção; em telas estreitas o menu vira uma linha de abas rolável.

import { useCallback, useRef, useState, type ReactNode } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import { useSearchParams } from 'react-router-dom';
import styled from 'styled-components';
import { Settings as SettingsIcon, UserRound, ShieldCheck, Plug, Building2, Mail, UserPlus } from 'lucide-react';
import { PageLayout } from '@/components/layout/PageLayout';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Table';
import { useAuth } from '@/contexts/AuthContext';
import { ProfileTab } from '@/pages/settings/ProfileTab';
import { SecurityTab } from '@/pages/settings/SecurityTab';
import { IntegrationsTab } from '@/pages/settings/IntegrationsTab';
import { OrganizationGeneralTab } from '@/pages/settings/OrganizationGeneralTab';
import { OrganizationEmailTab } from '@/pages/settings/OrganizationEmailTab';
import { OrganizationRegistrationTab } from '@/pages/settings/OrganizationRegistrationTab';
import { DirtyContext } from '@/pages/settings/SettingsParts';

const ProfileHeader = styled.div`
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem 1.25rem;
    background: ${({ theme }) => theme.colors.white};
    border: 1px solid ${({ theme }) => theme.colors.borderLight};
    border-radius: ${({ theme }) => theme.radii.md};
    box-shadow: ${({ theme }) => theme.shadows.e1};
    margin-bottom: 1rem;
`;

const Identity = styled.div`
    min-width: 0;

    strong {
        display: block;
        font-size: 1.05rem;
        color: ${({ theme }) => theme.colors.textDark};
    }

    span.email {
        display: block;
        font-size: 0.8125rem;
        color: ${({ theme }) => theme.colors.textMuted};
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
`;

const Badges = styled.div`
    margin-left: auto;
    display: flex;
    gap: 0.4rem;
    flex-wrap: wrap;
    justify-content: flex-end;
`;

const Shell = styled.div`
    display: flex;
    gap: 1.5rem;
    align-items: flex-start;

    @media (max-width: 860px) {
        flex-direction: column;
        gap: 1rem;
    }
`;

const TabsList = styled(Tabs.List)`
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    width: 230px;
    flex-shrink: 0;
    position: sticky;
    top: 0;

    @media (max-width: 860px) {
        position: static;
        width: 100%;
        flex-direction: row;
        overflow-x: auto;
        gap: 0.25rem;
        padding-bottom: 0.25rem;
        border-bottom: 1px solid ${({ theme }) => theme.colors.borderLight};
    }
`;

const GroupLabel = styled.div`
    padding: 0.75rem 0.75rem 0.3rem;
    font-size: 0.6875rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: ${({ theme }) => theme.colors.textMuted};

    &:first-child {
        padding-top: 0;
    }

    @media (max-width: 860px) {
        display: none;
    }
`;

const TabsTrigger = styled(Tabs.Trigger)`
    position: relative;
    display: flex;
    align-items: center;
    gap: 0.65rem;
    padding: 0.55rem 0.75rem;
    border-radius: ${({ theme }) => theme.radii.sm};
    background: transparent;
    border: none;
    text-align: left;
    color: ${({ theme }) => theme.colors.textMedium};
    cursor: pointer;

    .text {
        display: flex;
        flex-direction: column;
        min-width: 0;
    }

    .label {
        font-size: 0.875rem;
        font-weight: 600;
    }

    .hint {
        font-size: 0.6875rem;
        font-weight: 400;
        color: ${({ theme }) => theme.colors.textMuted};
    }

    &:hover {
        background: ${({ theme }) => theme.colors.lightGray};
    }

    &[data-state='active'] {
        background: ${({ theme }) => theme.colors.primaryLight};
        color: ${({ theme }) => theme.colors.primary};
    }

    &[data-state='active']::before {
        content: '';
        position: absolute;
        left: 0;
        top: 20%;
        bottom: 20%;
        width: 3px;
        border-radius: 0 3px 3px 0;
        background: ${({ theme }) => theme.colors.primary};
    }

    @media (max-width: 860px) {
        flex: none;
        white-space: nowrap;

        .hint { display: none; }
        &[data-state='active']::before { display: none; }
    }
`;

const TabsContent = styled(Tabs.Content)`
    flex: 1;
    min-width: 0;
    width: 100%;
`;

const ROLE_LABEL: Record<string, string> = {
    SUPER_ADMIN: 'Super admin',
    GROUP_ADMIN: 'Admin do grupo',
    ORG_ADMIN: 'Administrador',
    ORG_USER: 'Usuário',
};

// SUPER_ADMIN "puro" (sem academia própria) não vê o grupo Academia — ver docs/decisoes.md. Um
// SUPER_ADMIN impersonando uma academia passa a ter role ORG_ADMIN nesse token, então cai aqui.
const ORGANIZATION_TAB_ROLES = ['ORG_ADMIN', 'GROUP_ADMIN'];

interface NavItem { value: string; label: string; hint: string; icon: ReactNode; content: ReactNode }

const ACCOUNT_ITEMS: NavItem[] = [
    { value: 'profile', label: 'Perfil', hint: 'Foto, nome e telefone', icon: <UserRound size={16} />, content: <ProfileTab /> },
    { value: 'security', label: 'Segurança', hint: 'Senha e 2FA', icon: <ShieldCheck size={16} />, content: <SecurityTab /> },
    { value: 'integrations', label: 'Integrações', hint: 'Google Calendar', icon: <Plug size={16} />, content: <IntegrationsTab /> },
];

const ORGANIZATION_ITEMS: NavItem[] = [
    { value: 'org-general', label: 'Geral', hint: 'Nome e identificação', icon: <Building2 size={16} />, content: <OrganizationGeneralTab /> },
    { value: 'org-email', label: 'E-mail', hint: 'Remetente e domínios', icon: <Mail size={16} />, content: <OrganizationEmailTab /> },
    { value: 'org-registration', label: 'Cadastro público', hint: 'Link de autocadastro', icon: <UserPlus size={16} />, content: <OrganizationRegistrationTab /> },
];

export default function Settings() {
    const { user, organization } = useAuth();
    const canEditOrganization = !!user?.role && ORGANIZATION_TAB_ROLES.includes(user.role);
    const items = canEditOrganization ? [...ACCOUNT_ITEMS, ...ORGANIZATION_ITEMS] : ACCOUNT_ITEMS;

    const [searchParams, setSearchParams] = useSearchParams();
    // Volta do redirect OAuth do Google (ver IntegrationsTab): precisa abrir direto em Integrações,
    // senão o toast de sucesso/erro aparece sobre outra aba sem contexto.
    const requested = searchParams.has('success') || searchParams.has('error') ? 'integrations' : searchParams.get('tab');
    const [tab, setTab] = useState(items.some((i) => i.value === requested) ? requested! : 'profile');

    const dirtyRef = useRef(false);
    const reportDirty = useCallback((dirty: boolean) => { dirtyRef.current = dirty; }, []);

    const changeTab = (next: string) => {
        if (next === tab) return;
        if (dirtyRef.current && !window.confirm('Você tem alterações não salvas nesta aba. Descartá-las e continuar?')) return;
        dirtyRef.current = false;
        setTab(next);
        setSearchParams({ tab: next }, { replace: true });
    };

    const renderGroup = (label: string, group: NavItem[]) => (
        <>
            <GroupLabel>{label}</GroupLabel>
            {group.map((item) => (
                <TabsTrigger key={item.value} value={item.value}>
                    {item.icon}
                    <span className="text"><span className="label">{item.label}</span><span className="hint">{item.hint}</span></span>
                </TabsTrigger>
            ))}
        </>
    );

    return (
        <PageLayout title="Minha Conta" subtitle="Perfil, segurança e preferências" icon={<SettingsIcon size={16} />}>
            <ProfileHeader>
                <Avatar name={user?.name} avatarUrl={user?.avatarUrl} size={56} />
                <Identity>
                    <strong>{user?.name}</strong>
                    <span className="email">{user?.email}</span>
                </Identity>
                <Badges>
                    {organization?.name && <Badge $tone="neutral">{organization.name}</Badge>}
                    {user?.role && <Badge $tone="info">{ROLE_LABEL[user.role] ?? user.role}</Badge>}
                </Badges>
            </ProfileHeader>

            <DirtyContext.Provider value={reportDirty}>
                <Tabs.Root value={tab} onValueChange={changeTab} orientation="vertical">
                    <Shell>
                        <TabsList aria-label="Seções de configuração">
                            {renderGroup('Minha conta', ACCOUNT_ITEMS)}
                            {canEditOrganization && renderGroup('Academia', ORGANIZATION_ITEMS)}
                        </TabsList>
                        {items.map((item) => (
                            <TabsContent key={item.value} value={item.value}>{item.content}</TabsContent>
                        ))}
                    </Shell>
                </Tabs.Root>
            </DirtyContext.Provider>
        </PageLayout>
    );
}
