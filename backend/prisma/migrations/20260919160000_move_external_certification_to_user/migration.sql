-- Decisão 32 (docs/decisoes.md): ExternalCertification passa a pertencer
-- diretamente ao User, não mais ao StaffMember — certificação/qualificação
-- prévia é um fato sobre a pessoa, não sobre um papel específico.

-- DropForeignKey
ALTER TABLE "public"."ExternalCertification" DROP CONSTRAINT "ExternalCertification_staffMemberId_fkey";

-- DropIndex
DROP INDEX "public"."ExternalCertification_staffMemberId_idx";

-- AddColumn (nullable por enquanto, preenchida a seguir a partir do StaffMember)
ALTER TABLE "public"."ExternalCertification" ADD COLUMN "userId" TEXT;

-- Backfill: StaffMember.userId é único (1:1 com User), então dá pra migrar
-- cada certificação existente para o userId da pessoa que era staffMemberId.
UPDATE "public"."ExternalCertification" ec
SET "userId" = sm."userId"
FROM "public"."StaffMember" sm
WHERE ec."staffMemberId" = sm."id";

-- AlterColumn (agora que todo registro existente já tem userId preenchido)
ALTER TABLE "public"."ExternalCertification" ALTER COLUMN "userId" SET NOT NULL;

-- DropColumn
ALTER TABLE "public"."ExternalCertification" DROP COLUMN "staffMemberId";

-- CreateIndex
CREATE INDEX "ExternalCertification_userId_idx" ON "public"."ExternalCertification"("userId");

-- AddForeignKey
ALTER TABLE "public"."ExternalCertification" ADD CONSTRAINT "ExternalCertification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
