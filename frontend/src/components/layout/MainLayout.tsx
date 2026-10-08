// frontend/src/components/layout/MainLayout.tsx
//
// Casca nova e enxuta (sidebar + topbar), NÃO copiada do maskotCrmEdu — o
// LayoutSidebar original tem ~600 linhas de navegação de CRM/WhatsApp/Kanban
// que não existem neste produto. Aqui só a estrutura visual: navegação fixa
// para as rotas placeholder do bootstrap.

import { useEffect, useState, type ReactElement, type ReactNode } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import * as Tooltip from '@radix-ui/react-tooltip';
import { registrationsApi } from '@/services/registrations';
import styled, { css } from 'styled-components';
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
    UserPlus,
    PanelLeftClose,
    PanelLeftOpen,
    Ellipsis,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { hasPermission } from '@/utils/permissions';
import { Avatar } from '@/components/ui/Avatar';
import { NotificationBell } from './NotificationBell';

/** Abaixo disso o menu lateral vira gaveta (e o recolher/expandir deixa de fazer sentido). */
const MOBILE_BREAKPOINT = 900;

const Shell = styled.div`
    display: flex;
    height: 100vh;
    height: 100dvh;
    width: 100%;
    padding: 1rem;
    gap: 1rem;
    box-sizing: border-box;
    background: ${({ theme }) => theme.colors.pageBackground};
    overflow: hidden;

    /* Celular: conteúdo em cima, barra de navegação embaixo (o menu lateral é gaveta, fora do fluxo). */
    @media (max-width: ${MOBILE_BREAKPOINT}px) {
        flex-direction: column;
        padding: 0.5rem;
        gap: 0.5rem;
    }
`;

const Sidebar = styled.aside<{ $collapsed: boolean; $open: boolean }>`
    width: ${({ $collapsed }) => ($collapsed ? '72px' : '248px')};
    flex-shrink: 0;
    background: linear-gradient(180deg, #23272b 0%, #1a1d21 100%);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: ${({ theme }) => theme.radii.lg};
    box-shadow: ${({ theme }) => theme.shadows.e2};
    color: white;
    display: flex;
    flex-direction: column;
    padding: 1.25rem 0.75rem;
    overflow: hidden;
    transition: width 0.2s ease;

    /* Celular: o menu vira uma gaveta por cima do conteúdo, aberta pelo botão do topo. */
    @media (max-width: ${MOBILE_BREAKPOINT}px) {
        position: fixed;
        top: 0.5rem;
        bottom: 0.5rem;
        left: 0.5rem;
        width: min(280px, calc(100vw - 3rem));
        z-index: 1000;
        transform: translateX(${({ $open }) => ($open ? '0' : 'calc(-100% - 1rem)')});
        visibility: ${({ $open }) => ($open ? 'visible' : 'hidden')};
        transition: transform 0.2s ease, visibility 0.2s;
    }

    .nav-label {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    /* Recolhido: só ícones — os rótulos somem e os itens centralizam o ícone. */
    ${({ $collapsed }) =>
        $collapsed &&
        `
        .nav-label, .brand-text, .section-label {
            display: none;
        }

        .nav-entry, .brand {
            justify-content: center;
            padding-left: 0;
            padding-right: 0;
        }

        .nav-badge {
            position: absolute;
            top: 2px;
            right: 4px;
            margin: 0;
            min-width: 1rem;
            padding: 0 0.25rem;
            font-size: 0.5625rem;
        }
    `}
`;

const TooltipContent = styled(Tooltip.Content)`
    background-color: #343a40;
    color: white;
    border-radius: 6px;
    padding: 6px 10px;
    font-size: 12px;
    font-weight: 500;
    line-height: 1.4;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 10002;
    white-space: nowrap;
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
    overflow-x: hidden;
`;

const CountBadge = styled.span`
    margin-left: auto;
    min-width: 1.25rem;
    padding: 0.05rem 0.4rem;
    border-radius: 999px;
    background: #e03131;
    color: #fff;
    font-size: 0.6875rem;
    font-weight: 700;
    text-align: center;
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
    transition: background 0.15s ease, color 0.15s ease, transform 0.15s ease;

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
        transform: translateX(2px);
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

const CollapseButton = styled(SignOutButton)`
    margin-top: 0.75rem;
`;

const Content = styled.div`
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    overflow: hidden;
`;

const Topbar = styled.header`
    height: 64px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    padding: 0 1.25rem;
    border-radius: ${({ theme }) => theme.radii.lg};
    background: ${({ theme }) => theme.colors.white};
    box-shadow: ${({ theme }) => theme.shadows.e1};

    @media (max-width: ${MOBILE_BREAKPOINT}px) {
        height: 56px;
        padding: 0 0.75rem;
    }
`;

const BottomBar = styled.nav`
    flex-shrink: 0;
    display: flex;
    align-items: stretch;
    gap: 0.25rem;
    padding: 0.25rem 0.25rem calc(0.25rem + env(safe-area-inset-bottom));
    border-radius: ${({ theme }) => theme.radii.lg};
    background: ${({ theme }) => theme.colors.white};
    box-shadow: ${({ theme }) => theme.shadows.e2};
`;

const bottomItemStyles = css`
    position: relative;
    flex: 1;
    min-width: 0;
    min-height: 52px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.2rem;
    padding: 0.3rem 0.25rem;
    border: none;
    border-radius: ${({ theme }) => theme.radii.sm};
    background: transparent;
    color: ${({ theme }) => theme.colors.textMuted};
    font-size: 0.6875rem;
    font-weight: 600;
    line-height: 1.1;
    text-decoration: none;
    cursor: pointer;

    span {
        max-width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    &.active {
        background: ${({ theme }) => theme.colors.primaryLight};
        color: ${({ theme }) => theme.colors.primary};
    }

    &:focus-visible {
        outline: 2px solid ${({ theme }) => theme.colors.primary};
        outline-offset: -2px;
    }
`;

const BottomItem = styled(NavLink)`
    ${bottomItemStyles}
`;

const BottomButton = styled.button`
    ${bottomItemStyles}

    &[aria-expanded='true'] {
        background: ${({ theme }) => theme.colors.primaryLight};
        color: ${({ theme }) => theme.colors.primary};
    }
`;

const BottomDot = styled.i`
    position: absolute;
    top: 6px;
    left: calc(50% + 6px);
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: #e03131;
    border: 2px solid #fff;
`;

const Backdrop = styled.div`
    position: fixed;
    inset: 0;
    z-index: 999;
    background: rgba(20, 23, 28, 0.5);
`;

const Greeting = styled.div`
    font-size: 0.875rem;
    font-weight: 600;
    color: ${({ theme }) => theme.colors.textDark};

    span {
        font-weight: 400;
        color: ${({ theme }) => theme.colors.textMuted};
    }
`;

const TopbarRight = styled.div`
    display: flex;
    align-items: center;
    gap: 0.5rem;
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

    @media (max-width: 640px) {
        display: none;
    }
`;

const Main =styled.div`
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
    border-radius: ${({ theme }) => theme.radii.lg};
    box-shadow: ${({ theme }) => theme.shadows.e1};
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

type NavEntry = { to: string; label: string; icon: typeof UserPlus; badge?: number };

/**
 * Ordem de preferência dos atalhos da barra inferior do celular: ficam os 3 primeiros que o perfil
 * tem no menu (aluno: Painel, Minhas Turmas, Meus Certificados; coordenação: Painel, Turmas,
 * Pessoas; plataforma: Academias). O resto vai para a gaveta, aberta pelo "Mais".
 */
const BOTTOM_NAV_PREFERENCE = ['/admin/organizations', '/dashboard', '/courses', '/my-courses', '/people', '/my-certificates', '/certificates', '/events'];
const BOTTOM_NAV_SIZE = 3;

const SIDEBAR_COLLAPSED_KEY = 'pronthea:sidebar-collapsed';

function readSidebarCollapsed() {
    try {
        return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1';
    } catch {
        return false;
    }
}

// Com o menu recolhido só o ícone fica visível — o tooltip devolve o nome do
// item. Expandido, o rótulo já está na tela e o tooltip seria redundante.
function SidebarTooltip({ label, show, children }: { label: string; show: boolean; children: ReactElement }) {
    if (!show) return children;
    return (
        <Tooltip.Provider delayDuration={150}>
            <Tooltip.Root>
                <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
                <Tooltip.Portal>
                    <TooltipContent side="right" sideOffset={10}>
                        {label}
                        <Tooltip.Arrow style={{ fill: '#343a40' }} />
                    </TooltipContent>
                </Tooltip.Portal>
            </Tooltip.Root>
        </Tooltip.Provider>
    );
}

function getGreeting() {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bom dia';
    if (hour < 18) return 'Boa tarde';
    return 'Boa noite';
}

function useIsMobile() {
    const query = `(max-width: ${MOBILE_BREAKPOINT}px)`;
    const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
    useEffect(() => {
        const media = window.matchMedia(query);
        const onChange = () => setMatches(media.matches);
        onChange();
        media.addEventListener('change', onChange);
        return () => media.removeEventListener('change', onChange);
    }, [query]);
    return matches;
}

export function MainLayout({ children }: { children: ReactNode }) {
    const { user, organization, signOut, isImpersonating, impersonatedOrganizationName, stopImpersonation } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const isMobile = useIsMobile();
    const [collapsedPreference, setCollapsed] = useState(readSidebarCollapsed);
    const [drawerOpen, setDrawerOpen] = useState(false);
    // Na gaveta do celular os rótulos sempre aparecem: "recolhido" só vale no desktop.
    const collapsed = collapsedPreference && !isMobile;
    const drawerVisible = isMobile && drawerOpen;

    // Navegou (ou girou o aparelho): a gaveta fecha sozinha. Esc também fecha.
    useEffect(() => setDrawerOpen(false), [location.pathname, isMobile]);
    useEffect(() => {
        if (!drawerVisible) return;
        const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setDrawerOpen(false);
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [drawerVisible]);
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
    const canReviewRegistrations = !isSuperAdmin && hasPermission(user, 'registrations:manage');
    const { data: pendingRegistrations } = useQuery({
        queryKey: ['registrations', 'pending-count'],
        queryFn: () => registrationsApi.pendingCount(),
        enabled: canReviewRegistrations,
        refetchInterval: 60_000,
    });

    const navItems: NavEntry[] = isSuperAdmin
        ? []
        : [
              { to: '/dashboard', label: 'Painel', icon: LayoutDashboard },
              hasPermission(user, 'courses:manage')
                  ? { to: '/courses', label: 'Turmas', icon: GraduationCap }
                  : { to: '/my-courses', label: 'Minhas Turmas', icon: GraduationCap },
              { to: '/events', label: 'Eventos', icon: CalendarClock },
              // Designação é escala de equipe: aluno que não é da equipe nunca teria nada ali.
              ...(hasPermission(user, 'staff:manage')
                  ? [{ to: '/staff', label: 'Equipe', icon: ShieldCheck }]
                  : user?.staffMember
                    ? [{ to: '/my-designations', label: 'Minhas Designações', icon: ShieldCheck }]
                    : []),
              ...(hasPermission(user, 'people:manage') ? [{ to: '/people', label: 'Pessoas', icon: Users }] : []),
              ...(hasPermission(user, 'registrations:manage') ? [{ to: '/registrations', label: 'Cadastros', icon: UserPlus, badge: pendingRegistrations }] : []),
              hasPermission(user, 'certificates:manage')
                  ? { to: '/certificates', label: 'Certificados', icon: Award }
                  : { to: '/my-certificates', label: 'Meus Certificados', icon: Award },
          ];

    const bottomCandidates: NavEntry[] = isSuperAdmin ? [{ to: '/admin/organizations', label: 'Academias', icon: Building2 }] : navItems;
    const bottomItems = BOTTOM_NAV_PREFERENCE.flatMap((to) => bottomCandidates.filter((entry) => entry.to === to)).slice(0, BOTTOM_NAV_SIZE);
    // Algo pendente escondido na gaveta (ex.: cadastros a aprovar) ganha um ponto no "Mais".
    const hiddenPending = navItems.some((entry) => !!entry.badge && !bottomItems.includes(entry));

    const toggleCollapsed = () => {
        setCollapsed((prev) => {
            const next = !prev;
            try {
                localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? '1' : '0');
            } catch {
                // sem storage (aba privada etc.) — só não persiste a preferência
            }
            return next;
        });
    };

    const renderNavItem = ({ to, label, icon: Icon, badge }: NavEntry) => (
        <SidebarTooltip key={to} label={label} show={collapsed}>
            <NavItem to={to} className="nav-entry" aria-label={collapsed ? label : undefined}>
                <Icon size={18} />
                <span className="nav-label">{label}</span>
                {!!badge && (
                    <CountBadge className="nav-badge" aria-label={`${badge} pendente(s)`}>
                        {badge > 99 ? '99+' : badge}
                    </CountBadge>
                )}
            </NavItem>
        </SidebarTooltip>
    );

    const collapseLabel = collapsed ? 'Expandir menu' : 'Recolher menu';

    return (
        <Shell>
            {drawerVisible && <Backdrop onClick={() => setDrawerOpen(false)} aria-hidden />}
            <Sidebar $collapsed={collapsed} $open={drawerOpen} id="menu-lateral" aria-label="Menu principal">
                <Brand className="brand">
                    <BrandIcon><Flame size={18} /></BrandIcon>
                    <BrandText className="brand-text">
                        <strong>Pronthea</strong>
                        <span>Portal de treinamentos</span>
                    </BrandText>
                </Brand>

                <Nav>
                    {navItems.map(renderNavItem)}

                    {isOrgAdmin && renderNavItem({ to: '/roles', label: 'Cargos', icon: ShieldCheck })}

                    {hasPermission(user, 'communications:manage') &&
                        renderNavItem({ to: '/admin/emails', label: 'E-mails e comunicados', icon: Mail })}

                    {isSuperAdmin && (
                        <>
                            <NavSectionLabel className="section-label">Plataforma</NavSectionLabel>
                            {renderNavItem({ to: '/admin/organizations', label: 'Academias', icon: Building2 })}
                        </>
                    )}

                    <NavDivider />
                    {renderNavItem({ to: '/settings', label: 'Minha Conta', icon: Settings })}
                </Nav>

                {!isMobile && (
                    <SidebarTooltip label={collapseLabel} show={collapsed}>
                        <CollapseButton
                            className="nav-entry"
                            onClick={toggleCollapsed}
                            aria-label={collapseLabel}
                            aria-expanded={!collapsed}
                        >
                            {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
                            <span className="nav-label">{collapseLabel}</span>
                        </CollapseButton>
                    </SidebarTooltip>
                )}

                <SidebarTooltip label="Sair" show={collapsed}>
                    <SignOutButton className="nav-entry" onClick={signOut} aria-label={collapsed ? 'Sair' : undefined}>
                        <LogOut size={18} />
                        <span className="nav-label">Sair</span>
                    </SignOutButton>
                </SidebarTooltip>
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
                    <Greeting>
                        <span>{getGreeting()},</span> {user?.name?.split(' ')[0]}
                    </Greeting>
                    <TopbarRight>
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
                    </TopbarRight>
                </Topbar>
                <Main>{children}</Main>
            </Content>

            {isMobile && (
                <BottomBar aria-label="Navegação principal">
                    {bottomItems.map(({ to, label, icon: Icon }) => (
                        <BottomItem key={to} to={to}>
                            <Icon size={20} />
                            <span>{label.replace(/^(Minhas|Meus) /, '')}</span>
                        </BottomItem>
                    ))}
                    <BottomButton type="button" onClick={() => setDrawerOpen(true)} aria-expanded={drawerVisible} aria-controls="menu-lateral">
                        <Ellipsis size={20} />
                        <span>Mais</span>
                        {hiddenPending && <BottomDot aria-label="Há itens pendentes no menu" />}
                    </BottomButton>
                </BottomBar>
            )}
        </Shell>
    );
}
