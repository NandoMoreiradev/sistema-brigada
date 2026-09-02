import { IsString, IsOptional, IsUrl } from 'class-validator';

export class UpdateMeetingDto {
    @IsString()
    @IsOptional()
    agenda?: string;

    @IsString()
    @IsOptional()
    minutes?: string;

    @IsUrl({}, { message: 'A URL do Meet fornecida é inválida.' })
    @IsOptional()
    meetUrl?: string;
}
