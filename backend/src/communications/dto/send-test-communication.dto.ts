// backend/src/communications/dto/send-test-communication.dto.ts

import { IsEmail, IsNotEmpty } from 'class-validator';

export class SendTestCommunicationDto {
    @IsEmail({}, { message: 'Informe um e-mail válido.' })
    @IsNotEmpty({ message: 'O e-mail não pode estar vazio.' })
    to: string;
}
