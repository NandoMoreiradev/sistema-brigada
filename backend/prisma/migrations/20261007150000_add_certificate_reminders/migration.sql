-- Lembretes de vencimento de certificado configuráveis por academia + histórico de envio.

-- CreateEnum
CREATE TYPE "public"."CertificateReminderDigestFrequency" AS ENUM ('OFF', 'DAILY', 'WEEKLY');

-- CreateEnum
CREATE TYPE "public"."CertificateReminderStatus" AS ENUM ('SENDING', 'SENT', 'FAILED', 'SKIPPED');

-- AlterEnum
ALTER TYPE "public"."EmailTriggerType" ADD VALUE 'CERTIFICATE_EXPIRED';

-- CreateTable
CREATE TABLE "public"."CertificateReminderSettings" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "daysBefore" INTEGER[] DEFAULT ARRAY[30]::INTEGER[],
    "daysAfter" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "sendHour" INTEGER NOT NULL DEFAULT 8,
    "includeRecyclingSuggestion" BOOLEAN NOT NULL DEFAULT true,
    "digestFrequency" "public"."CertificateReminderDigestFrequency" NOT NULL DEFAULT 'OFF',
    "digestRecipientUserIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "digestWindowDays" INTEGER NOT NULL DEFAULT 30,
    "lastDigestSentAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CertificateReminderSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CertificateReminder" (
    "id" TEXT NOT NULL,
    "certificateId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "status" "public"."CertificateReminderStatus" NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "error" TEXT,
    "sentAt" TIMESTAMP(3),
    "triggeredByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CertificateReminder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CertificateReminderSettings_organizationId_key" ON "public"."CertificateReminderSettings"("organizationId");

-- CreateIndex
CREATE INDEX "CertificateReminder_organizationId_idx" ON "public"."CertificateReminder"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "CertificateReminder_certificateId_stage_key" ON "public"."CertificateReminder"("certificateId", "stage");

-- AddForeignKey
ALTER TABLE "public"."CertificateReminderSettings" ADD CONSTRAINT "CertificateReminderSettings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CertificateReminder" ADD CONSTRAINT "CertificateReminder_certificateId_fkey" FOREIGN KEY ("certificateId") REFERENCES "public"."Certificate"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Avisos de vencimento já enviados pelo job antigo (1 aviso, 30 dias antes) viram a etapa
-- "before:30" já cumprida — sem isso, quem já foi avisado receberia o mesmo aviso de novo.
-- O job antigo identificava o aviso pelo link da notificação (/my-certificates#<id>).
INSERT INTO "public"."CertificateReminder" ("id", "certificateId", "organizationId", "stage", "status", "attempts", "sentAt", "createdAt", "updatedAt")
SELECT DISTINCT ON (c."id") md5(random()::text || c."id"), c."id", c."organizationId", 'before:30', 'SENT', 1, n."createdAt", n."createdAt", n."createdAt"
FROM "public"."Notification" n
JOIN "public"."Certificate" c ON n."link" = '/my-certificates#' || c."id"
WHERE n."type" = 'CERTIFICATE_EXPIRING'
ORDER BY c."id", n."createdAt"
ON CONFLICT ("certificateId", "stage") DO NOTHING;
