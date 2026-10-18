import { ArrayMaxSize, ArrayMinSize, IsArray, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class PromoteStaffMembersBulkDto {
    /** Ids dos `User` a promover de uma vez (ex.: uma turma inteira de alunos). */
    @IsArray()
    @ArrayMinSize(1)
    @ArrayMaxSize(500)
    @IsString({ each: true })
    @IsNotEmpty({ each: true })
    userIds: string[];

    @IsOptional()
    @IsString()
    @IsNotEmpty()
    categoryId?: string;
}
