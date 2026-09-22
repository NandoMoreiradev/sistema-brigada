// frontend/src/components/layout/MainLayout.tsx
//
// Casca nova e enxuta (sidebar + topbar), NÃO copiada do maskotCrmEdu — o
// LayoutSidebar original tem ~600 linhas de navegação de CRM/WhatsApp/Kanban
// que não existem neste produto. Aqui só a estrutura visual: navegação fixa
// para as rotas placeholder do bootstrap.

import type { ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import {
    LayoutDashboard,
    GraduationCap,
    CalendarClock,
    ShieldCheck,
    Users,
    Building2,
    LogOut,
    Flame,
    Award,
    Settings,
    ChevronDown,
    Mail,
    Eye,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { hasPermission } from '@/utils/permissions';
import { Avatar } from '@/components/ui/Avatar';
import { NotificationBell } from './NotificationBell';

const Shell = styled.div`
    display: flex;
    height: 100vh;
    height: 100dvh;
    width: 100%;
    background: ${({ theme }) => theme.colors.pageBackground};
    overflow: hidden;
`;

const Sidebar = styled.aside`
    width: 248px;
    flex-shrink: 0;
    background: linear-gradient(180deg, #23272b 0%, #1a1d21 100%);
    color: white;
    display: flex;
    flex-direction: column;
    padding: 1.25rem 0.75rem;
`;

const Brand = styled.div`
    display: flex;
    align-items: center;
    gap: 0.65rem;
    padding: 0.25rem 0.5rem 1.5rem;
`;

const BrandIcon = styled.div`
    width: 34px;
    height: 34px;
    border-radius: 9px;
    background: linear-gradient(135deg, #d9480f, #e8590c);
    box-shadow: 0 4px 12px rgba(217, 72, 15, 0.35);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
`;

const BrandText = styled.div`
    line-height: 1.25;
    min-width: 0;

    strong {
        display: block;
        font-weight: 700;
        font-size: 0.9375rem;
        white-space: nowrap;
    }

    span {
        display: block;
        font-size: 0.6875rem;
        color: rgba(255, 255, 255, 0.45);
        font-weight: 500;
    }
`;

const Nav = styled.nav`
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    flex: 1;
    overflow-y: auto;
`;

const NavItem = styled(NavLink)`
    position: relative;
    display: flex;
    align-items: center;
    gap: 0.65rem;
    padding: 0.6rem 0.75rem 0.6rem 1rem;
    border-radius: ${({ theme }) => theme.radii.sm};
    color: rgba(255, 255, 255, 0.65);
    text-decoration: none;
    font-size: 0.875rem;
    font-weight: 500;
    transition: background 0.15s ease, color 0.15s ease;

    svg {
        flex-shrink: 0;
        opacity: 0.85;
    }

    &::before {
        content: '';
        position: absolute;
        left: 0;
        top: 50%;
        transform: translateY(-50%);
        width: 3px;
        height: 0;
        border-radius: ${({ theme }) => theme.radii.pill};
        background: #e8590c;
        transition: height 0.15s ease;
    }

    &:hover {
        background: rgba(255, 255, 255, 0.06);
        color: white;
    }

    &.active {
        background: rgba(232, 89, 12, 0.16);
        color: white;

        &::before {
            height: 18px;
        }
    }
`;

const NavDivider = styled.div`
    height: 1px;
    background: rgba(255, 255, 255, 0.1);
    margin: 0.75rem 0.5rem;
`;

const NavSectionLabel = styled.div`
    padding: 0 0.75rem 0 1rem;
    font-size: 0.6875rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.35);
    margin-bottom: 0.3rem;
`;

const SignOutButton = styled.button`
    display: flex;
    align-items: center;
    gap: 0.65rem;
    padding: 0.6rem 0.75rem 0.6rem 1rem;
    border-radius: ${({ theme }) => theme.radii.sm};
    color: rgba(255, 255, 255, 0.55);
    background: transparent;
    border: none;
    cursor: pointer;
    font-size: 0.8125rem;
    font-weight: 500;
    width: 100%;
    text-align: left;
    margin-top: 0.5rem;

    &:hover {
        background: rgba(255, 255, 255, 0.06);
        color: white;
    }
`;

const Content = styled.div`
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
`;

const Topbar = styled.header`
    height: 60px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.5rem;
    padding: 0 1.25rem;
    background: ${({ theme }) => theme.colors.white};
    border-bottom: 1px solid ${({ theme }) => theme.colors.borderLight};
`;

const TopbarDivider = styled.div`
    width: 1px;
    height: 24px;
    background: ${({ theme }) => theme.colors.borderLight};
    margin: 0 0.25rem;
`;

const UserMenuButton = styled.button`
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.35rem 0.5rem 0.35rem 0.4rem;
    border-radius: ${({ theme }) => theme.radii.pill};
    background: transparent;
    border: none;
    cursor: pointer;
    transition: background 0.15s ease;

    &:hover {
        background: ${({ theme }) => theme.colors.lightGray};
    }
`;

const UserBadge = styled.div`
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    line-height: 1.2;

    strong {
        font-size: 0.8125rem;
        color: ${({ theme }) => theme.colors.textDark};
    }

    span {
        font-size: 0.7rem;
        color: ${({ theme }) => theme.colors.textMuted};
    }
`;

const Main = styled.div`
    flex: 1;
    min-height: 0;
    overflow: hidden;
`;

const ImpersonationBar = styled.div`
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.6rem;
    padding: 0.5rem 1.25rem;
    background: ${({ theme }) => theme.colors.warning};
    color: #4a3800;
    font-size: 0.8125rem;
    font-weight: 600;

    button {
        display: inline-flex;
        align-items: center;
        gap: 0.3rem;
        padding: 0.25rem 0.65rem;
        border-radius: ${({ theme }) => theme.radii.pill};
        border: 1px solid rgba(74, 56, 0, 0.3);
        background: rgba(255, 255, 255, 0.5);
        color: #4a3800;
        font-size: 0.75rem;
        font-weight: 700;
        cursor: pointer;

        &:hover {
            background: rgba(255, 255, 255, 0.8);
        }
    }
`;

const ADMIN_ROLES = ['SUPER_ADMIN', 'GROUP_ADMIN', 'ORG_ADMIN'];

export function MainLayout({ children }: { children: ReactNode }) {
    const { user, organization, signOut, isImpersonating, impersonatedOrganizationName, stopImpersonation } = useAuth();
    const navigate = useNavigate();
    const isSuperAdmin = user?.role === 'SUPER_ADMIN';
    const isOrgAdmin = !!user?.role && ADMIN_ROLES.includes(user.role) && !isSuperAdmin;

    // SUPER_ADMIN é usuário de plataforma, sem organização própria e sem
    // organização ativa selecionável na UI (ver docs/decisoes.md) — os itens
    // abaixo (Turmas/Eventos/Equipe/Pessoas/Certificados/Cargos/Modelos de
    // e-mail) dependem de ActiveOrganizationId no backend e retornam 400 pra
    // ele. Por isso o menu do SUPER_ADMIN mostra só a seção Plataforma.
    //
    // Fase 3 de posse de dado (docs/decisoes.md): quem tem a permissão
    // administrativa do módulo vê a listagem completa da organização; quem
    // não tem vê só o recorte pessoal (/me/*). Eventos fica de fora dessa
    // troca de propósito — reuniões/assembleias são abertas a toda a
    // organização por design (ver meetings.service.ts), não só a quem
    // administra.
    const navItems = isSuperAdmin
        ? []
        : [
              { to: '/dashboard', label: 'Painel', icon: LayoutDashboard },
              hasPermission(user, 'courses:manage')
                  ? { to: '/courses', label: 'Turmas', icon: GraduationCap }
                  : { to: '/my-courses', label: 'Minhas Turmas', icon: GraduationCap },
              { to: '/events', label: 'Eventos', icon: CalendarClock },
              hasPermission(user, 'staff:manage')
                  ? { to: '/staff', label: 'Equipe', icon: ShieldCheck }
                  : { to: '/my-designations', label: 'Minhas Designações', icon: ShieldCheck },
              ...(hasPermission(user, 'people:manage') ? [{ to: '/people', label: 'Pessoas', icon: Users }] : []),
              hasPermission(user, 'certificates:manage')
                  ? { to: '/certificates', label: 'Certificados', icon: Award }
                  : { to: '/my-certificates', label: 'Meus Certificados', icon: Award },
          ];

    return (
        <Shell>
            <Sidebar>
                <Brand>
                    <BrandIcon><Flame size={18} /></BrandIcon>
                    <BrandText>
                        <strong>Ignis</strong>
                        <span>Portal de treinamentos</span>
                    </BrandText>
                </Brand>

                <Nav>
                    {navItems.map(({ to, label, icon: Icon }) => (
                        <NavItem key={to} to={to}>
                            <Icon size={18} />
                            {label}
                        </NavItem>
                    ))}

                    {isOrgAdmin && (
                        <NavItem to="/roles">
                            <ShieldCheck size={18} />
                            Cargos
                        </NavItem>
                    )}

                    {hasPermission(user, 'communications:manage') && (
                        <NavItem to="/admin/emails">
                            <Mail size={18} />
                            E-mails e comunicados
                        </NavItem>
                    )}

                    {isSuperAdmin && (
                        <>
                            <NavSectionLabel>Plataforma</NavSectionLabel>
                            <NavItem to="/admin/organizations">
                                <Building2 size={18} />
                                Academias
                            </NavItem>
                        </>
                    )}

                    <NavDivider />
                    <NavItem to="/settings">
                        <Settings size={18} />
                        Minha Conta
                    </NavItem>
                </Nav>

                <SignOutButton onClick={signOut}>
                    <LogOut size={18} />
                    Sair
                </SignOutButton>
            </Sidebar>

            <Content>
                {isImpersonating && (
                    <ImpersonationBar>
                        <Eye size={14} />
                        Você está acessando como <strong>{impersonatedOrganizationName}</strong>
                        <button onClick={stopImpersonation}>Voltar para admin</button>
                    </ImpersonationBar>
                )}
                <Topbar>
                    <NotificationBell />
                    <TopbarDivider />
                    <UserMenuButton onClick={() => navigate('/settings')} title="Minha Conta">
                        <Avatar name={user?.name} avatarUrl={user?.avatarUrl} size={34} />
                        <UserBadge>
                            <strong>{user?.name}</strong>
                            <span>{organization?.name || user?.role}</span>
                        </UserBadge>
                        <ChevronDown size={14} color="#adb5bd" />
                    </UserMenuButton>
                </Topbar>
                <Main>{children}</Main>
            </Content>
        </Shell>
    );
}
