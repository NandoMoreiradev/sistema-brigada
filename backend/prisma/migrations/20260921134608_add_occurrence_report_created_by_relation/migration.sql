-- AddForeignKey
ALTER TABLE "public"."OccurrenceReport" ADD CONSTRAINT "OccurrenceReport_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
