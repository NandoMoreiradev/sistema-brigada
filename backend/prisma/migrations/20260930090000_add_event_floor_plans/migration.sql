-- AlterTable
ALTER TABLE "public"."EventPost" ADD COLUMN     "floorPlanId" TEXT;

-- CreateTable
CREATE TABLE "public"."EventFloorPlan" (
    "id" TEXT NOT NULL,
    "eventOperationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "imageKey" TEXT,
    "imageUrl" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventFloorPlan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EventFloorPlan_eventOperationId_idx" ON "public"."EventFloorPlan"("eventOperationId");

-- CreateIndex
CREATE INDEX "EventPost_floorPlanId_idx" ON "public"."EventPost"("floorPlanId");

-- AddForeignKey
ALTER TABLE "public"."EventFloorPlan" ADD CONSTRAINT "EventFloorPlan_eventOperationId_fkey" FOREIGN KEY ("eventOperationId") REFERENCES "public"."EventOperation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EventPost" ADD CONSTRAINT "EventPost_floorPlanId_fkey" FOREIGN KEY ("floorPlanId") REFERENCES "public"."EventFloorPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Preenchimento: a planta única de cada evento (formato antigo) vira a "Planta 1" e os postos do
-- evento passam a pertencer a ela.
INSERT INTO "public"."EventFloorPlan" ("id", "eventOperationId", "name", "imageKey", "imageUrl", "order")
SELECT gen_random_uuid()::text, o."id", 'Planta 1', o."floorPlanKey", o."floorPlanUrl", 0
FROM "public"."EventOperation" o
WHERE o."floorPlanUrl" IS NOT NULL;

UPDATE "public"."EventPost" p
SET "floorPlanId" = f."id"
FROM "public"."EventFloorPlan" f
WHERE f."eventOperationId" = p."eventOperationId" AND p."floorPlanId" IS NULL;
