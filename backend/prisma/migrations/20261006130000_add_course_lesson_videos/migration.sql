-- CreateTable
CREATE TABLE "public"."CourseLessonVideo" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "title" TEXT,
    "url" TEXT NOT NULL,
    "storageKey" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourseLessonVideo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CourseLessonVideo_lessonId_idx" ON "public"."CourseLessonVideo"("lessonId");

-- AddForeignKey
ALTER TABLE "public"."CourseLessonVideo" ADD CONSTRAINT "CourseLessonVideo_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "public"."CourseLesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "public"."LessonProgress" ADD COLUMN "watchedVideoIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Migra o vídeo único de cada aula (videoUrl/videoKey) para a nova tabela.
INSERT INTO "public"."CourseLessonVideo" ("id", "lessonId", "url", "storageKey", "order")
SELECT 'lv_' || "id", "id", "videoUrl", "videoKey", 0
FROM "public"."CourseLesson"
WHERE "videoUrl" IS NOT NULL;

-- Quem já tinha a aula concluída também assistiu o vídeo migrado.
UPDATE "public"."LessonProgress" p
SET "watchedVideoIds" = ARRAY['lv_' || p."lessonId"]
FROM "public"."CourseLesson" l
WHERE l."id" = p."lessonId" AND p."completed" = true AND l."videoKey" IS NOT NULL;

-- AlterTable
ALTER TABLE "public"."CourseLesson" DROP COLUMN "videoKey",
DROP COLUMN "videoUrl";
