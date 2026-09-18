import { api } from './api';

export interface AppNotification {
    id: string;
    type: string;
    title: string;
    message: string | null;
    link: string | null;
    read: boolean;
    createdAt: string;
}

export interface NotificationsResponse {
    notifications: AppNotification[];
    unreadCount: number;
    total: number;
}

export const notificationsApi = {
    list: async (read?: boolean) => {
        const { data } = await api.get<NotificationsResponse>('/notifications', { params: { read, limit: 20 } });
        return data;
    },
    unreadCount: async () => {
        const { data } = await api.get<{ unreadCount: number }>('/notifications/unread-count');
        return data.unreadCount;
    },
    markAsRead: async (id: string) => {
        const { data } = await api.patch<AppNotification>(`/notifications/${id}/read`);
        return data;
    },
    markAllAsRead: async () => {
        await api.patch('/notifications/read-all');
    },
};
