-- Vários modelos de certificado por academia (CertificateDesign); a turma pode escolher
-- um. O layout sai de CertificateTemplate (que fica só com logo/assinatura).

-- CreateTable
CREATE TABLE "public"."CertificateDesign" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "layout" JSONB NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CertificateDesign_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CertificateDesign_organizationId_idx" ON "public"."CertificateDesign"("organizationId");

-- AddForeignKey
ALTER TABLE "public"."CertificateDesign" ADD CONSTRAINT "CertificateDesign_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Layout já personalizado vira o modelo padrão "Padrão" da academia, ANTES de apagar a coluna.
INSERT INTO "public"."CertificateDesign" ("id", "organizationId", "name", "layout", "isDefault", "createdAt", "updatedAt")
SELECT md5(random()::text || t."id"), t."organizationId", 'Padrão', t."layoutConfig", true, now(), now()
FROM "public"."CertificateTemplate" t
WHERE t."layoutConfig" IS NOT NULL;

-- AlterTable
ALTER TABLE "public"."CertificateTemplate" DROP COLUMN "layoutConfig";

-- AlterTable
ALTER TABLE "public"."Course" ADD COLUMN     "certificateDesignId" TEXT;

-- AddForeignKey
ALTER TABLE "public"."Course" ADD CONSTRAINT "Course_certificateDesignId_fkey" FOREIGN KEY ("certificateDesignId") REFERENCES "public"."CertificateDesign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
