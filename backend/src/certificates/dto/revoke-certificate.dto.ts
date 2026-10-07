import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class RevokeCertificateDto {
    /** Obrigatório: fica registrado e explica a revogação para quem administra depois. */
    @IsString()
    @IsNotEmpty({ message: 'Informe o motivo da revogação.' })
    @MaxLength(500)
    reason: string;
}
