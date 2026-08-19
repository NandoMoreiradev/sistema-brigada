// backend/src/notifications/dto/get-notifications.dto.ts
//
// Adaptado de maskotCrmEdu/backend/src/notifications/dto/get-notifications.dto.ts.
// Sem `priority` (não existe no model `Notification` deste projeto). `unreadOnly`
// virou `read` (opcional) para permitir filtrar tanto lidas quanto não lidas.

import { IsOptional, IsBoolean, IsInt, Min } from 'class-validator';
import { Transform } from 'class-transformer';

export class GetNotificationsDto {
    @IsOptional()
    @IsBoolean()
    @Transform(({ value }) => (value === undefined ? undefined : value === 'true' || value === true))
    read?: boolean;

    @IsOptional()
    @IsInt()
    @Min(1)
    @Transform(({ value }) => (value === undefined ? undefined : parseInt(value, 10)))
    limit?: number = 20;

    @IsOptional()
    @IsInt()
    @Min(0)
    @Transform(({ value }) => (value === undefined ? undefined : parseInt(value, 10)))
    offset?: number = 0;
}
