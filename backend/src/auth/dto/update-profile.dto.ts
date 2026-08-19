import { IsString, IsNotEmpty, IsOptional, IsUrl } from 'class-validator';

export class UpdateProfileDto {
    @IsString()
    @IsNotEmpty({ message: 'O nome não pode ser vazio.' })
    name: string;

    @IsString()
    @IsOptional()
    phone?: string;

    @IsUrl({}, { message: 'A URL do avatar fornecida é inválida.' })
    @IsOptional()
    avatarUrl?: string;
}
