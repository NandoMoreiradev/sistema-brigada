-- CreateTable
CREATE TABLE "public"."OccurrenceReportFile" (
    "id" TEXT NOT NULL,
    "occurrenceReportId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "storageKey" TEXT,
    "externalUrl" TEXT,
    "mimeType" TEXT,
    "uploadedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OccurrenceReportFile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OccurrenceReportFile_occurrenceReportId_idx" ON "public"."OccurrenceReportFile"("occurrenceReportId");

-- AddForeignKey
ALTER TABLE "public"."OccurrenceReportFile" ADD CONSTRAINT "OccurrenceReportFile_occurrenceReportId_fkey" FOREIGN KEY ("occurrenceReportId") REFERENCES "public"."OccurrenceReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
