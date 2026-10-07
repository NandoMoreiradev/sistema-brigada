-- Código de verificação público do certificado + dados de revogação.

-- AlterTable
ALTER TABLE "public"."Certificate" ADD COLUMN     "code" TEXT,
ADD COLUMN     "revokedAt" TIMESTAMP(3),
ADD COLUMN     "revokedReason" TEXT,
ADD COLUMN     "revokedByUserId" TEXT;

-- Backfill dos certificados já emitidos: 12 caracteres hexadecimais aleatórios. Hex é um
-- subconjunto do alfabeto base32 Crockford usado pelos códigos novos, então a busca
-- normalizada (O→0, I/L→1) vale igual para os dois.
UPDATE "public"."Certificate" SET "code" = upper(substr(md5(random()::text || "id"), 1, 12)) WHERE "code" IS NULL;

ALTER TABLE "public"."Certificate" ALTER COLUMN "code" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Certificate_code_key" ON "public"."Certificate"("code");

-- Certificados com validade já passada ficavam VALID para sempre (nada marcava EXPIRED).
UPDATE "public"."Certificate" SET "status" = 'EXPIRED' WHERE "status" = 'VALID' AND "expiresAt" < now();
