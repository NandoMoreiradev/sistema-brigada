-- Categoria da equipe (StaffCategory) em dois pontos novos: público de comunicado e convite de cadastro.
-- Só adiciona: nada do que já existe muda.

-- AlterEnum
ALTER TYPE "public"."CommunicationAudience" ADD VALUE 'STAFF_CATEGORY';

-- AlterTable
ALTER TABLE "public"."Communication" ADD COLUMN     "staffCategoryId" TEXT;

-- AlterTable
ALTER TABLE "public"."RegistrationInvite" ADD COLUMN     "staffCategoryId" TEXT;

-- CreateIndex
CREATE INDEX "Communication_staffCategoryId_idx" ON "public"."Communication"("staffCategoryId");

-- AddForeignKey
ALTER TABLE "public"."Communication" ADD CONSTRAINT "Communication_staffCategoryId_fkey" FOREIGN KEY ("staffCategoryId") REFERENCES "public"."StaffCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RegistrationInvite" ADD CONSTRAINT "RegistrationInvite_staffCategoryId_fkey" FOREIGN KEY ("staffCategoryId") REFERENCES "public"."StaffCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
