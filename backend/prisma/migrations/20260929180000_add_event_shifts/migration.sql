-- AlterTable
ALTER TABLE "public"."Designation" ADD COLUMN     "shiftId" TEXT;

-- CreateTable
CREATE TABLE "public"."EventShift" (
    "id" TEXT NOT NULL,
    "eventOperationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "start" TIMESTAMP(3) NOT NULL,
    "end" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventShift_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EventShift_eventOperationId_idx" ON "public"."EventShift"("eventOperationId");

-- CreateIndex
CREATE UNIQUE INDEX "EventShift_eventOperationId_start_end_key" ON "public"."EventShift"("eventOperationId", "start", "end");

-- CreateIndex
CREATE INDEX "Designation_shiftId_idx" ON "public"."Designation"("shiftId");

-- AddForeignKey
ALTER TABLE "public"."EventShift" ADD CONSTRAINT "EventShift_eventOperationId_fkey" FOREIGN KEY ("eventOperationId") REFERENCES "public"."EventOperation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Designation" ADD CONSTRAINT "Designation_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "public"."EventShift"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Preenchimento: cada janela de horário distinta já usada em designações de um evento vira um turno
-- (nome provisório "HH:MM–HH:MM" no fuso de São Paulo; a coordenação pode renomear para "Manhã" etc.)
-- e as designações passam a apontar para ele.
INSERT INTO "public"."EventShift" ("id", "eventOperationId", "name", "start", "end")
SELECT
    gen_random_uuid()::text,
    w."eventOperationId",
    to_char(w."shiftStart" AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI') || '–' ||
        to_char(w."shiftEnd" AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI'),
    w."shiftStart",
    w."shiftEnd"
FROM (SELECT DISTINCT "eventOperationId", "shiftStart", "shiftEnd" FROM "public"."Designation") w;

UPDATE "public"."Designation" d
SET "shiftId" = s."id"
FROM "public"."EventShift" s
WHERE s."eventOperationId" = d."eventOperationId" AND s."start" = d."shiftStart" AND s."end" = d."shiftEnd";
