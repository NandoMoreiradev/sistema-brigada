-- AlterTable
ALTER TABLE "public"."Designation" ADD COLUMN     "postId" TEXT,
ADD COLUMN     "teamId" TEXT;

-- AlterTable
ALTER TABLE "public"."EventOperation" ADD COLUMN     "floorPlanKey" TEXT,
ADD COLUMN     "floorPlanUrl" TEXT;

-- CreateTable
CREATE TABLE "public"."EventPost" (
    "id" TEXT NOT NULL,
    "eventOperationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "capacity" INTEGER,
    "notes" TEXT,
    "posX" DOUBLE PRECISION,
    "posY" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Team" (
    "id" TEXT NOT NULL,
    "eventOperationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EventPost_eventOperationId_idx" ON "public"."EventPost"("eventOperationId");

-- CreateIndex
CREATE INDEX "Team_eventOperationId_idx" ON "public"."Team"("eventOperationId");

-- CreateIndex
CREATE INDEX "Designation_postId_idx" ON "public"."Designation"("postId");

-- CreateIndex
CREATE INDEX "Designation_teamId_idx" ON "public"."Designation"("teamId");

-- AddForeignKey
ALTER TABLE "public"."EventPost" ADD CONSTRAINT "EventPost_eventOperationId_fkey" FOREIGN KEY ("eventOperationId") REFERENCES "public"."EventOperation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Team" ADD CONSTRAINT "Team_eventOperationId_fkey" FOREIGN KEY ("eventOperationId") REFERENCES "public"."EventOperation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Designation" ADD CONSTRAINT "Designation_postId_fkey" FOREIGN KEY ("postId") REFERENCES "public"."EventPost"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Designation" ADD CONSTRAINT "Designation_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "public"."Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
