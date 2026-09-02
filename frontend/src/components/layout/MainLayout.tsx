// frontend/src/components/layout/MainLayout.tsx
//
// Casca nova e enxuta (sidebar + topbar), NÃO copiada do maskotCrmEdu — o
// LayoutSidebar original tem ~600 linhas de navegação de CRM/WhatsApp/Kanban
// que não existem neste produto. Aqui só a estrutura visual: navegação fixa
// para as rotas placeholder do bootstrap.

import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
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
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
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
    width: 240px;
    flex-shrink: 0;
    background: ${({ theme }) => theme.colors.textDark};
    color: white;
    display: flex;
    flex-direction: column;
    padding: 1.25rem 0.75rem;
`;

const Brand = styled.div`
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0 0.5rem 1.5rem;
    font-weight: 700;
    font-size: 1.05rem;
`;

const BrandIcon = styled.div`
    width: 32px;
    height: 32px;
    border-radius: 8px;
    background: linear-gradient(135deg, #d9480f, #e8590c);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
`;

const Nav = styled.nav`
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    flex: 1;
`;

const NavItem = styled(NavLink)`
    display: flex;
    align-items: center;
    gap: 0.65rem;
    padding: 0.6rem 0.75rem;
    border-radius: ${({ theme }) => theme.radii.sm};
    color: rgba(255, 255, 255, 0.75);
    text-decoration: none;
    font-size: 0.875rem;
    font-weight: 500;
    transition: background 0.15s ease, color 0.15s ease;

    &:hover {
        background: rgba(255, 255, 255, 0.08);
        color: white;
    }

    &.active {
        background: rgba(232, 89, 12, 0.25);
        color: white;
    }
`;

const NavDivider = styled.div`
    height: 1px;
    background: rgba(255, 255, 255, 0.12);
    margin: 0.75rem 0.5rem;
`;

const NavSectionLabel = styled.div`
    padding: 0 0.75rem;
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: rgba(255, 255, 255, 0.4);
    margin-bottom: 0.25rem;
`;

const SignOutButton = styled.button`
    display: flex;
    align-items: center;
    gap: 0.65rem;
    padding: 0.6rem 0.75rem;
    border-radius: ${({ theme }) => theme.radii.sm};
    color: rgba(255, 255, 255, 0.75);
    background: transparent;
    border: none;
    cursor: pointer;
    font-size: 0.875rem;
    font-weight: 500;
    width: 100%;
    text-align: left;

    &:hover {
        background: rgba(255, 255, 255, 0.08);
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
    height: 56px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.75rem;
    padding: 0 1.5rem;
    background: ${({ theme }) => theme.colors.white};
    border-bottom: 1px solid ${({ theme }) => theme.colors.borderLight};
`;

const UserBadge = styled.div`
    display: flex;
    flex-direction: column;
    align-items: flex-end;
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

const NAV_ITEMS = [
    { to: '/dashboard', label: 'Painel', icon: LayoutDashboard },
    { to: '/courses', label: 'Turmas', icon: GraduationCap },
    { to: '/events', label: 'Eventos', icon: CalendarClock },
    { to: '/staff', label: 'Equipe', icon: ShieldCheck },
    { to: '/students', label: 'Alunos', icon: Users },
    { to: '/certificates', label: 'Certificados', icon: Award },
];

export function MainLayout({ children }: { children: ReactNode }) {
    const { user, organization, signOut } = useAuth();
    const isSuperAdmin = user?.role === 'SUPER_ADMIN';

    return (
        <Shell>
            <Sidebar>
                <Brand>
                    <BrandIcon><Flame size={18} /></BrandIcon>
                    Brigada Treinamentos
                </Brand>

                <Nav>
                    {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
                        <NavItem key={to} to={to}>
                            <Icon size={18} />
                            {label}
                        </NavItem>
                    ))}

                    {isSuperAdmin && (
                        <>
                            <NavDivider />
                            <NavSectionLabel>Plataforma</NavSectionLabel>
                            <NavItem to="/admin/organizations">
                                <Building2 size={18} />
                                Academias
                            </NavItem>
                        </>
                    )}
                </Nav>

                <SignOutButton onClick={signOut}>
                    <LogOut size={18} />
                    Sair
                </SignOutButton>
            </Sidebar>

            <Content>
                <Topbar>
                    <NotificationBell />
                    <UserBadge>
                        <strong>{user?.name}</strong>
                        <span>{organization?.name || user?.role}</span>
                    </UserBadge>
                </Topbar>
                <Main>{children}</Main>
            </Content>
        </Shell>
    );
}
