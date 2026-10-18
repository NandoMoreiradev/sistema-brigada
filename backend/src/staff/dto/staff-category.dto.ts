import { IsNotEmpty, IsString, MaxLength, ValidateIf } from 'class-validator';

export class StaffCategoryDto {
    @IsString()
    @IsNotEmpty({ message: 'Informe o nome da categoria.' })
    @MaxLength(60, { message: 'O nome da categoria deve ter no máximo 60 caracteres.' })
    name: string;
}

export class SetStaffMemberCategoryDto {
    /** `null` tira a pessoa de qualquer categoria. */
    @ValidateIf((dto: SetStaffMemberCategoryDto) => dto.categoryId !== null)
    @IsString()
    @IsNotEmpty()
    categoryId: string | null;
}
