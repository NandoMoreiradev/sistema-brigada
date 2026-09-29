// Corpo do POST do convite: o e-mail e o papel vêm do convite, nunca do corpo.

import { OmitType } from '@nestjs/mapped-types';
import { SubmitRegistrationDto } from './submit-registration.dto';

export class SubmitInviteRegistrationDto extends OmitType(SubmitRegistrationDto, ['email', 'requestedKind'] as const) {}
