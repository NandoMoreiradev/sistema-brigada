-- CreateEnum
CREATE TYPE "public"."EmailTriggerType" AS ENUM ('ORGANIZATION_ADMIN_WELCOME', 'PASSWORD_RESET', 'CERTIFICATE_EXPIRING');

-- AlterTable
ALTER TABLE "public"."Organization" ADD COLUMN     "resendApiKey" TEXT,
ADD COLUMN     "emailFromAddress" TEXT,
ADD COLUMN     "emailFromName" TEXT;

-- CreateTable
CREATE TABLE "public"."EmailTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "designJson" JSONB,
    "trigger" "public"."EmailTriggerType",
    "organizationId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmailTemplate_organizationId_idx" ON "public"."EmailTemplate"("organizationId");

-- CreateIndex
CREATE INDEX "EmailTemplate_trigger_idx" ON "public"."EmailTemplate"("trigger");

-- CreateIndex
CREATE UNIQUE INDEX "EmailTemplate_organizationId_trigger_key" ON "public"."EmailTemplate"("organizationId", "trigger");

-- AddForeignKey
ALTER TABLE "public"."EmailTemplate" ADD CONSTRAINT "EmailTemplate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EmailTemplate" ADD CONSTRAINT "EmailTemplate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
