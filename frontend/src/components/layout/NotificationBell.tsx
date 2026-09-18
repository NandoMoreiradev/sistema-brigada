// frontend/src/components/layout/NotificationBell.tsx
//
// Primeiro consumidor real do endpoint `/notifications` (até agora só
// existia a API, sem UI — ver notifications.service.ts no backend). Sino no
// topbar com contagem de não lidas (poll a cada 30s) + lista das últimas
// notificações num popover.

import { useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import styled from 'styled-components';
import { Bell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { notificationsApi, type AppNotification } from '@/services/notifications';

const BellButton = styled.button`
    position: relative;
    background: transparent;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.4rem;
    border-radius: ${({ theme }) => theme.radii.sm};
    color: ${({ theme }) => theme.colors.textMedium};

    &:hover {
        background: ${({ theme }) => theme.colors.lightGray};
    }
`;

const UnreadBadge = styled.span`
    position: absolute;
    top: 2px;
    right: 2px;
    min-width: 16px;
    height: 16px;
    padding: 0 3px;
    border-radius: ${({ theme }) => theme.radii.pill};
    background: ${({ theme }) => theme.colors.danger};
    color: white;
    font-size: 0.625rem;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
`;

const Content = styled(Popover.Content)`
    width: 340px;
    max-height: 420px;
    overflow-y: auto;
    background: ${({ theme }) => theme.colors.white};
    border-radius: ${({ theme }) => theme.radii.md};
    box-shadow: ${({ theme }) => theme.shadows.e3};
    border: 1px solid ${({ theme }) => theme.colors.borderLight};
    z-index: 100;
`;

const Header = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid ${({ theme }) => theme.colors.borderLight};

    strong {
        font-size: 0.8125rem;
        color: ${({ theme }) => theme.colors.textDark};
    }

    button {
        background: none;
        border: none;
        color: ${({ theme }) => theme.colors.primary};
        font-size: 0.75rem;
        font-weight: 600;
        cursor: pointer;
    }
`;

const NotificationItem = styled.button<{ $unread: boolean }>`
    display: block;
    width: 100%;
    text-align: left;
    padding: 0.7rem 1rem;
    background: ${({ $unread, theme }) => ($unread ? theme.colors.primaryLight : 'transparent')};
    border: none;
    border-bottom: 1px solid ${({ theme }) => theme.colors.borderLight};
    cursor: pointer;

    &:hover {
        background: ${({ theme }) => theme.colors.lightGray};
    }

    strong {
        display: block;
        font-size: 0.8125rem;
        color: ${({ theme }) => theme.colors.textDark};
        margin-bottom: 0.15rem;
    }

    p {
        margin: 0;
        font-size: 0.75rem;
        color: ${({ theme }) => theme.colors.textMedium};
    }

    span {
        display: block;
        margin-top: 0.25rem;
        font-size: 0.6875rem;
        color: ${({ theme }) => theme.colors.textMuted};
    }
`;

const EmptyState = styled.div`
    padding: 2rem 1rem;
    text-align: center;
    font-size: 0.8125rem;
    color: ${({ theme }) => theme.colors.textMuted};
`;

export function NotificationBell() {
    const [open, setOpen] = useState(false);
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const { data: unreadCount } = useQuery({
        queryKey: ['notifications', 'unread-count'],
        queryFn: () => notificationsApi.unreadCount(),
        refetchInterval: 30000,
    });

    const { data } = useQuery({
        queryKey: ['notifications', 'list'],
        queryFn: () => notificationsApi.list(),
        enabled: open,
    });

    const markAsReadMutation = useMutation({
        mutationFn: (id: string) => notificationsApi.markAsRead(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
        },
    });

    const markAllAsReadMutation = useMutation({
        mutationFn: () => notificationsApi.markAllAsRead(),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
    });

    const handleClick = (notification: AppNotification) => {
        if (!notification.read) {
            markAsReadMutation.mutate(notification.id);
        }
        setOpen(false);
        if (notification.link) {
            navigate(notification.link.split('#')[0]);
        }
    };

    return (
        <Popover.Root open={open} onOpenChange={setOpen}>
            <Popover.Trigger asChild>
                <BellButton aria-label="Notificações">
                    <Bell size={18} />
                    {!!unreadCount && <UnreadBadge>{unreadCount > 9 ? '9+' : unreadCount}</UnreadBadge>}
                </BellButton>
            </Popover.Trigger>
            <Popover.Portal>
                <Content align="end" sideOffset={8}>
                    <Header>
                        <strong>Notificações</strong>
                        {!!unreadCount && (
                            <button type="button" onClick={() => markAllAsReadMutation.mutate()}>
                                Marcar todas como lidas
                            </button>
                        )}
                    </Header>
                    {(data?.notifications ?? []).map((notification) => (
                        <NotificationItem key={notification.id} $unread={!notification.read} onClick={() => handleClick(notification)}>
                            <strong>{notification.title}</strong>
                            {notification.message && <p>{notification.message}</p>}
                            <span>{formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true, locale: ptBR })}</span>
                        </NotificationItem>
                    ))}
                    {data && data.notifications.length === 0 && <EmptyState>Nenhuma notificação ainda.</EmptyState>}
                </Content>
            </Popover.Portal>
        </Popover.Root>
    );
}
