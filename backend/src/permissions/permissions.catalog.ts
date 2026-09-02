// backend/src/permissions/permissions.catalog.ts
//
// Catálogo fixo de permissões — inspirado em ALL_PERMISSIONS do maskotCrmEdu
// (C:\Users\motoe\Documents\maskotCrmEdu\backend\src\config\permissions.config.ts),
// mas bem mais enxuto: 1 permissão por domínio já construído nesta sessão, em
// vez de 1 por ação (create/read/update/delete separados). Refinar para
// granularidade maior é trabalho futuro, se a equipe pedir (ex: separar
// "matricular aluno" de "criar turma").
//
// Cada `id` é usado como PK do model `Permission` (schema.prisma) e como
// argumento de `@RequirePermission(id)` nos controllers.

export interface PermissionCatalogEntry {
    id: string;
    name: string;
    description: string;
    module: string;
    group: string;
}

export const PERMISSIONS_CATALOG: PermissionCatalogEntry[] = [
    {
        id: 'people:manage',
        name: 'Gerenciar Pessoas e Cargos',
        description: 'Permite cadastrar/editar alunos, instrutores e demais pessoas, e atribuir cargos.',
        module: 'PEOPLE',
        group: 'Pessoas',
    },
    {
        id: 'courses:manage',
        name: 'Gerenciar Turmas',
        description: 'Permite criar/editar turmas, salas, aulas agendadas, vídeo-aulas e matrículas.',
        module: 'COURSES',
        group: 'Turmas',
    },
    {
        id: 'events:manage',
        name: 'Gerenciar Eventos',
        description: 'Permite criar/editar assembleias, congressos, atuações de brigada e reuniões, além de escalas e anexos.',
        module: 'EVENTS',
        group: 'Eventos',
    },
    {
        id: 'certificates:manage',
        name: 'Gerenciar Certificados',
        description: 'Permite regerar PDF, emitir certificado manualmente e editar a personalização visual.',
        module: 'CERTIFICATES',
        group: 'Certificados',
    },
    {
        id: 'staff:manage',
        name: 'Gerenciar Equipe',
        description: 'Permite promover pessoas para a equipe de atuação (brigadista/bombeiro) e registrar certificações externas.',
        module: 'STAFF',
        group: 'Equipe',
    },
];
