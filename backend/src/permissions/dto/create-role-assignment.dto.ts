import { IsString, IsNotEmpty, IsArray, ArrayMinSize } from 'class-validator';

export class CreateRoleAssignmentDto {
    @IsString()
    @IsNotEmpty({ message: 'O nome do cargo não pode ser vazio.' })
    name: string;

    @IsArray()
    @ArrayMinSize(1, { message: 'Selecione ao menos uma permissão para o cargo.' })
    @IsString({ each: true, message: 'Cada permissão deve ser uma string válida.' })
    permissionIds: string[];
}
