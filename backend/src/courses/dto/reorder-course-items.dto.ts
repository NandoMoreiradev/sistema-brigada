import { ArrayMinSize, IsArray, IsNotEmpty, IsString } from 'class-validator';

export class ReorderCourseModulesDto {
    /** Ids de TODOS os módulos da turma, na nova ordem. */
    @IsArray()
    @ArrayMinSize(1)
    @IsString({ each: true })
    ids: string[];
}

export class ReorderCourseLessonsDto {
    @IsString()
    @IsNotEmpty()
    moduleId: string;

    /** Ids de TODAS as aulas ativas do módulo, na nova ordem. */
    @IsArray()
    @ArrayMinSize(1)
    @IsString({ each: true })
    ids: string[];
}
