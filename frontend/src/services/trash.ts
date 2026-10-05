// frontend/src/services/trash.ts
// Cliente da lixeira (backend/src/trash): itens soft-deletados de turmas, eventos, pessoas e cargos.

import { api } from './api';

export type TrashEntity = 'courses' | 'events' | 'people' | 'roles';

export interface TrashItem {
    id: string;
    name: string;
    deletedAt: string;
    /** Contexto curto para reconhecer o item (tipo, e-mail, nº de matrículas...). */
    description?: string;
}

export interface PurgeCheck {
    name: string;
    items: Array<{ label: string; count: number }>;
    files: number;
}

export interface RestoreResult {
    message: string;
    /** Efeitos colaterais que o admin precisa saber (ex.: link do Google Meet perdido). */
    warnings: string[];
}

export const trashApi = {
    list: (entity: TrashEntity) => api.get<TrashItem[]>(`/trash/${entity}`).then((r) => r.data),
    restore: (entity: TrashEntity, id: string) => api.post<RestoreResult>(`/trash/${entity}/${id}/restore`).then((r) => r.data),
    purgeCheck: (entity: TrashEntity, id: string) => api.get<PurgeCheck>(`/trash/${entity}/${id}/purge-check`).then((r) => r.data),
    purge: (entity: TrashEntity, id: string) => api.delete<{ message: string }>(`/trash/${entity}/${id}`).then((r) => r.data),
};
