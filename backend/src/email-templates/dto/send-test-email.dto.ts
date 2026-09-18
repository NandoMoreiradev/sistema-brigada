// backend/src/email-templates/dto/send-test-email.dto.ts

import { IsEmail, IsNotEmpty } from 'class-validator';

export class SendTestEmailDto {
    @IsEmail({}, { message: 'Informe um e-mail válido.' })
    @IsNotEmpty({ message: 'O e-mail não pode estar vazio.' })
    to: string;
}
