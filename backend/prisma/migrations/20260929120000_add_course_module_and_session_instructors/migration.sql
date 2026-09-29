-- DropIndex
DROP INDEX "public"."ClassLog_classSessionId_key";

-- AlterTable
ALTER TABLE "public"."ClassSession" ADD COLUMN     "topic" TEXT;

-- CreateTable
CREATE TABLE "public"."ClassSessionInstructor" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClassSessionInstructor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CourseModuleInstructor" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourseModuleInstructor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClassSessionInstructor_userId_idx" ON "public"."ClassSessionInstructor"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ClassSessionInstructor_sessionId_userId_key" ON "public"."ClassSessionInstructor"("sessionId", "userId");

-- CreateIndex
CREATE INDEX "CourseModuleInstructor_userId_idx" ON "public"."CourseModuleInstructor"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CourseModuleInstructor_moduleId_userId_key" ON "public"."CourseModuleInstructor"("moduleId", "userId");

-- CreateIndex
CREATE INDEX "ClassLog_createdByUserId_idx" ON "public"."ClassLog"("createdByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "ClassLog_classSessionId_createdByUserId_key" ON "public"."ClassLog"("classSessionId", "createdByUserId");

-- Diários órfãos (autor já removido) impediriam criar a FK nova: não há como exibi-los sem autor.
DELETE FROM "public"."ClassLog" WHERE "createdByUserId" NOT IN (SELECT "id" FROM "public"."User");

-- AddForeignKey
ALTER TABLE "public"."ClassLog" ADD CONSTRAINT "ClassLog_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ClassSessionInstructor" ADD CONSTRAINT "ClassSessionInstructor_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "public"."ClassSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ClassSessionInstructor" ADD CONSTRAINT "ClassSessionInstructor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CourseModuleInstructor" ADD CONSTRAINT "CourseModuleInstructor_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "public"."CourseModule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CourseModuleInstructor" ADD CONSTRAINT "CourseModuleInstructor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

