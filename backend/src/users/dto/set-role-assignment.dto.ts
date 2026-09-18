import { IsOptional, IsString } from 'class-validator';

export class SetRoleAssignmentDto {
    @IsOptional()
    @IsString()
    roleAssignmentId?: string | null;
}
