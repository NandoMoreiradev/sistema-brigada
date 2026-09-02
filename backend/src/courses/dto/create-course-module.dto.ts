import { IsString, IsNotEmpty, IsOptional, IsInt, Min } from 'class-validator';

export class CreateCourseModuleDto {
    @IsString()
    @IsNotEmpty({ message: 'Informe o título do módulo.' })
    title: string;

    @IsInt()
    @Min(0)
    @IsOptional()
    order?: number;
}
