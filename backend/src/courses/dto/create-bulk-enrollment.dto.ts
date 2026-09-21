import { IsArray, ArrayMinSize, IsString } from 'class-validator';

export class CreateBulkEnrollmentDto {
    /** Ids de `User` (cada um já precisa ter StudentProfile) a matricular de uma vez. */
    @IsArray()
    @ArrayMinSize(1, { message: 'Selecione pelo menos um aluno para matricular.' })
    @IsString({ each: true })
    userIds: string[];
}
