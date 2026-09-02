// backend/src/users/dto/create-user.dto.ts
//
// Cria uma pessoa (usuário) dentro da organização ativa. Decisão 8 do
// docs/decisoes.md: aluno/instrutor/staff são papéis acumulados sobre o mesmo
// `User`, não cadastros separados — por isso `studentProfile` é opcional e
// aninhado aqui, em vez de existir um endpoint `students` à parte. `role` só
// aceita os papéis de organização (ORG_ADMIN/ORG_USER); SUPER_ADMIN/GROUP_ADMIN
// são papéis de plataforma, fora do escopo deste endpoint.

import { IsString, IsNotEmpty, IsOptional, IsEmail, IsIn, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { Role } from '@prisma/client';
import { IsStrongPassword } from '../../auth/dto/is-strong-password.decorator';
import { StudentProfileDto } from './student-profile.dto';

const ASSIGNABLE_ROLES = [Role.ORG_ADMIN, Role.ORG_USER] as const;

export class CreateUserDto {
    @IsString()
    @IsNotEmpty({ message: 'O nome não pode ser vazio.' })
    name: string;

    @IsEmail({}, { message: 'O e-mail informado é inválido.' })
    email: string;

    @IsStrongPassword()
    password: string;

    @IsString()
    @IsOptional()
    phone?: string;

    @IsIn(ASSIGNABLE_ROLES, { message: 'Papel inválido. Use ORG_ADMIN ou ORG_USER.' })
    @IsOptional()
    role?: (typeof ASSIGNABLE_ROLES)[number];

    @IsOptional()
    @ValidateNested()
    @Type(() => StudentProfileDto)
    studentProfile?: StudentProfileDto;
}
