-- CreateTable
CREATE TABLE "public"."CourseLessonFile" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "storageKey" TEXT,
    "externalUrl" TEXT,
    "mimeType" TEXT,
    "size" INTEGER,
    "uploadedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourseLessonFile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CourseLessonFile_lessonId_idx" ON "public"."CourseLessonFile"("lessonId");

-- AddForeignKey
ALTER TABLE "public"."CourseLessonFile" ADD CONSTRAINT "CourseLessonFile_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "public"."CourseLesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;
