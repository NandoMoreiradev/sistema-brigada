import { IsArray, IsString } from 'class-validator';

export class SetDirectPermissionsDto {
    @IsArray()
    @IsString({ each: true })
    permissionIds: string[];
}
