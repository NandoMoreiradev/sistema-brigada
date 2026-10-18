import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class PromoteStaffMemberDto {
    /** Id do `User` a promover para staff/brigadista — decisão 8: mesmo cadastro, não duplica. */
    @IsString()
    @IsNotEmpty()
    userId: string;

    /** Categoria inicial na equipe (opcional; decisão 78). */
    @IsOptional()
    @IsString()
    @IsNotEmpty()
    categoryId?: string;
}
