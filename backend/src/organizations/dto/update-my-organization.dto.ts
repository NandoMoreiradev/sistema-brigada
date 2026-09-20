// backend/src/organizations/dto/update-my-organization.dto.ts
//
// Auto-edição da própria academia por ORG_ADMIN/GROUP_ADMIN (rota
// `PATCH /organizations/me`, distinta de `PATCH /organizations/:id`, que
// continua exclusiva de SUPER_ADMIN e opera sobre qualquer academia por id).
//
// Omite isMatrix/parentOrganizationId/enabledModules de propósito: são campos
// de hierarquia/plataforma definidos pelo SUPER_ADMIN no onboarding (ver
// CreateOrganizationDto), não preferências que a própria academia deveria
// poder mudar sozinha.

import { PickType } from '@nestjs/mapped-types';
import { UpdateOrganizationDto } from './update-organization.dto';

export class UpdateMyOrganizationDto extends PickType(UpdateOrganizationDto, [
    'name',
    'subdomain',
    'groupName',
    'resendApiKey',
    'emailFromAddress',
    'emailFromName',
] as const) {}
