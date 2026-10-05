-- Programação da turma: grupos (quem), atividades (o quê, quanto tempo, com quem), blocos da
-- programação de cada grupo por dia, equipes de instrutores e modelos reaproveitáveis.

-- CreateEnum
CREATE TYPE "public"."ScheduleActivityKind" AS ENUM ('ACTIVITY', 'BREAK', 'MEAL');

-- AlterTable
ALTER TABLE "public"."ClassSession" ADD COLUMN     "fromSchedule" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "groupId" TEXT;

-- AlterTable
ALTER TABLE "public"."Enrollment" ADD COLUMN     "groupId" TEXT;

-- CreateTable
CREATE TABLE "public"."CourseGroup" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "roomId" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourseGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."InstructorTeam" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InstructorTeam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."InstructorTeamMember" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "InstructorTeamMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CourseActivity" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "kind" "public"."ScheduleActivityKind" NOT NULL DEFAULT 'ACTIVITY',
    "durationMinutes" INTEGER NOT NULL,
    "roomId" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourseActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CourseActivityAssignee" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "teamId" TEXT,
    "userId" TEXT,

    CONSTRAINT "CourseActivityAssignee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ScheduleBlock" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "groupId" TEXT,
    "date" DATE NOT NULL,
    "order" INTEGER NOT NULL,
    "activityId" TEXT NOT NULL,
    "startTime" CHAR(5) NOT NULL,
    "endTime" CHAR(5) NOT NULL,

    CONSTRAINT "ScheduleBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ScheduleTemplate" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduleTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CourseGroup_courseId_idx" ON "public"."CourseGroup"("courseId");

-- CreateIndex
CREATE UNIQUE INDEX "CourseGroup_courseId_name_key" ON "public"."CourseGroup"("courseId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "InstructorTeam_organizationId_name_key" ON "public"."InstructorTeam"("organizationId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "InstructorTeamMember_teamId_userId_key" ON "public"."InstructorTeamMember"("teamId", "userId");

-- CreateIndex
CREATE INDEX "CourseActivity_courseId_idx" ON "public"."CourseActivity"("courseId");

-- CreateIndex
CREATE INDEX "CourseActivityAssignee_activityId_idx" ON "public"."CourseActivityAssignee"("activityId");

-- CreateIndex
CREATE INDEX "ScheduleBlock_courseId_date_idx" ON "public"."ScheduleBlock"("courseId", "date");

-- CreateIndex
CREATE INDEX "ScheduleBlock_date_idx" ON "public"."ScheduleBlock"("date");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduleTemplate_organizationId_name_key" ON "public"."ScheduleTemplate"("organizationId", "name");

-- AddForeignKey
ALTER TABLE "public"."ClassSession" ADD CONSTRAINT "ClassSession_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "public"."CourseGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CourseGroup" ADD CONSTRAINT "CourseGroup_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "public"."Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CourseGroup" ADD CONSTRAINT "CourseGroup_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "public"."Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."InstructorTeam" ADD CONSTRAINT "InstructorTeam_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."InstructorTeamMember" ADD CONSTRAINT "InstructorTeamMember_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "public"."InstructorTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."InstructorTeamMember" ADD CONSTRAINT "InstructorTeamMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CourseActivity" ADD CONSTRAINT "CourseActivity_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "public"."Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CourseActivity" ADD CONSTRAINT "CourseActivity_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "public"."Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CourseActivityAssignee" ADD CONSTRAINT "CourseActivityAssignee_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "public"."CourseActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CourseActivityAssignee" ADD CONSTRAINT "CourseActivityAssignee_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "public"."InstructorTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CourseActivityAssignee" ADD CONSTRAINT "CourseActivityAssignee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ScheduleBlock" ADD CONSTRAINT "ScheduleBlock_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "public"."Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ScheduleBlock" ADD CONSTRAINT "ScheduleBlock_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "public"."CourseGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ScheduleBlock" ADD CONSTRAINT "ScheduleBlock_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "public"."CourseActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ScheduleTemplate" ADD CONSTRAINT "ScheduleTemplate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Enrollment" ADD CONSTRAINT "Enrollment_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "public"."CourseGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

