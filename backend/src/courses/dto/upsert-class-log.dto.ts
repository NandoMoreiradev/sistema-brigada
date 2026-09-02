import { IsString, IsNotEmpty } from 'class-validator';

export class UpsertClassLogDto {
    @IsString()
    @IsNotEmpty({ message: 'O conteúdo do diário de aula não pode ser vazio.' })
    content: string;
}
