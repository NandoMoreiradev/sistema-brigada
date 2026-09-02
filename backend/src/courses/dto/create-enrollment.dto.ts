import { IsString, IsNotEmpty } from 'class-validator';

export class CreateEnrollmentDto {
    /** Id do `User` (com StudentProfile) a matricular — não o studentProfileId. */
    @IsString()
    @IsNotEmpty()
    userId: string;
}
