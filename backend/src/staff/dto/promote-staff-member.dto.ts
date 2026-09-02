import { IsString, IsNotEmpty } from 'class-validator';

export class PromoteStaffMemberDto {
    /** Id do `User` a promover para staff/brigadista — decisão 8: mesmo cadastro, não duplica. */
    @IsString()
    @IsNotEmpty()
    userId: string;
}
