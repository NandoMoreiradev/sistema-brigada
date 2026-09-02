import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateOccurrenceReportDto {
    /** Livre: "MEDICAL", "SAFETY", "BEHAVIORAL", "GENERAL"... */
    @IsString()
    @IsNotEmpty()
    type: string;

    @IsString()
    @IsNotEmpty()
    title: string;

    @IsString()
    @IsOptional()
    description?: string;
}
