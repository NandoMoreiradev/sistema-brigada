import { IsString, IsNotEmpty } from 'class-validator';

export class AssignInstructorDto {
    @IsString()
    @IsNotEmpty()
    userId: string;
}
