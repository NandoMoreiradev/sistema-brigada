import { api } from './api';

export interface Permission {
    id: string;
    name: string;
    description: string | null;
    module: string;
    group: string;
}

export type GroupedPermissions = Record<string, Permission[]>;

export interface RoleAssignment {
    id: string;
    name: string;
    isDeletable: boolean;
    permissions: Permission[];
    _count: { users: number };
}

export const permissionsApi = {
    listGrouped: async () => {
        const { data } = await api.get<GroupedPermissions>('/permissions');
        return data;
    },
};

export const roleAssignmentsApi = {
    list: async () => {
        const { data } = await api.get<RoleAssignment[]>('/role-assignments');
        return data;
    },
    create: async (input: { name: string; permissionIds: string[] }) => {
        const { data } = await api.post<RoleAssignment>('/role-assignments', input);
        return data;
    },
    update: async (id: string, input: { name?: string; permissionIds?: string[] }) => {
        const { data } = await api.patch<RoleAssignment>(`/role-assignments/${id}`, input);
        return data;
    },
    remove: async (id: string) => {
        await api.delete(`/role-assignments/${id}`);
    },
};
