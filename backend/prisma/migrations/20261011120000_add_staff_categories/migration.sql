-- Categorias da equipe de atuação (Brigadista, Bombeiro Civil...), catálogo por academia.
-- Só adiciona: quem já é da equipe fica sem categoria (coluna nula) e segue escalável.

-- CreateTable
CREATE TABLE "public"."StaffCategory" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffCategory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StaffCategory_organizationId_idx" ON "public"."StaffCategory"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "StaffCategory_organizationId_name_key" ON "public"."StaffCategory"("organizationId", "name");

-- AddForeignKey
ALTER TABLE "public"."StaffCategory" ADD CONSTRAINT "StaffCategory_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "public"."StaffMember" ADD COLUMN     "categoryId" TEXT;

-- CreateIndex
CREATE INDEX "StaffMember_categoryId_idx" ON "public"."StaffMember"("categoryId");

-- AddForeignKey
ALTER TABLE "public"."StaffMember" ADD CONSTRAINT "StaffMember_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."StaffCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Categorias iniciais para as academias que já existem (editáveis e excluíveis pela academia).
INSERT INTO "public"."StaffCategory" ("id", "organizationId", "name", "createdAt", "updatedAt")
SELECT md5(random()::text || o."id" || c."name"), o."id", c."name", now(), now()
FROM "public"."Organization" o
CROSS JOIN (VALUES ('Brigadista'), ('Bombeiro Civil'), ('Coordenador')) AS c("name");
