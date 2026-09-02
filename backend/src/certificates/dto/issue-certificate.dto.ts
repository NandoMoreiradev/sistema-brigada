import { IsString, IsNotEmpty } from 'class-validator';

export class IssueCertificateDto {
    @IsString()
    @IsNotEmpty()
    enrollmentId: string;
}
