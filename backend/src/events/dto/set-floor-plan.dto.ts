// backend/src/events/dto/set-floor-plan.dto.ts
// floorPlanKey/floorPlanUrl vêm de um upload feito antes via
// POST /media/presigned-url (contexto 'event-floor-plan').

import { IsString, IsNotEmpty } from 'class-validator';

export class SetFloorPlanDto {
    @IsString()
    @IsNotEmpty()
    floorPlanKey: string;

    @IsString()
    @IsNotEmpty()
    floorPlanUrl: string;
}
