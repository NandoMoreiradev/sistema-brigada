import { IsString, IsNotEmpty, IsOptional, IsInt, Min } from 'class-validator';

export class CreateRoomDto {
    @IsString()
    @IsNotEmpty({ message: 'O nome da sala não pode ser vazio.' })
    name: string;

    @IsInt()
    @Min(1)
    @IsOptional()
    capacity?: number;
}
