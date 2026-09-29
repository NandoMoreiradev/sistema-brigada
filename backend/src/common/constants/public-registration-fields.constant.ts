// backend/src/common/constants/public-registration-fields.constant.ts
//
// Catálogo fixo dos campos opcionais de PersonProfile (dados pessoais de qualquer papel) que uma academia pode escolher
// exibir no seu formulário público de autocadastro (Organization.publicRegistrationFields).
// Não é form-builder livre — só toggle sobre este catálogo. Vive em `common/` porque é
// usado tanto por `organizations/` (DTO de configuração) quanto por `registrations/`
// (validação da submissão pública), evitando dependência cruzada entre os dois módulos.

export const PUBLIC_REGISTRATION_FIELD_CATALOG = [
    'birthDate',
    'baptismDate',
    'pioneerStatus',
    'signedPetitions',
    'profession',
] as const;

export type PublicRegistrationField = (typeof PUBLIC_REGISTRATION_FIELD_CATALOG)[number];

export const PUBLIC_REGISTRATION_FIELD_LABELS: Record<PublicRegistrationField, string> = {
    birthDate: 'Data de nascimento',
    baptismDate: 'Data de batismo',
    pioneerStatus: 'Situação de pioneiro',
    signedPetitions: 'Petições assinadas',
    profession: 'Profissão',
};
