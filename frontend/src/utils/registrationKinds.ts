// Rótulos e descrições dos papéis de cadastro (aluno / instrutor / equipe), usados no convite,
// no formulário público, nos links do autocadastro e na revisão.

import type { RegistrationKind } from '@/types';

export const KIND_ORDER: RegistrationKind[] = ['STUDENT', 'INSTRUCTOR', 'STAFF'];

export const KIND_LABEL: Record<RegistrationKind, string> = {
    STUDENT: 'Aluno',
    INSTRUCTOR: 'Instrutor',
    STAFF: 'Equipe',
};

export const KIND_HINT: Record<RegistrationKind, string> = {
    STUDENT: 'Cria o perfil de aluno, pronto para matrícula em turmas.',
    INSTRUCTOR: 'Sem perfil de aluno; pode ser escalado como instrutor de turmas.',
    STAFF: 'Sem perfil de aluno; já entra como integrante da equipe (escalas de eventos).',
};

/** Valor do `?tipo=` no link público de cadastro. */
export const KIND_QUERY: Record<RegistrationKind, string> = { STUDENT: 'aluno', INSTRUCTOR: 'instrutor', STAFF: 'equipe' };

export function kindFromQuery(value: string | null): RegistrationKind {
    return (KIND_ORDER.find((kind) => KIND_QUERY[kind] === value) ?? 'STUDENT');
}
