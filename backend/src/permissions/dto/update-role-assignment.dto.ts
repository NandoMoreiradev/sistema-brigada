import { PartialType } from '@nestjs/mapped-types';
import { CreateRoleAssignmentDto } from './create-role-assignment.dto';

export class UpdateRoleAssignmentDto extends PartialType(CreateRoleAssignmentDto) {}
