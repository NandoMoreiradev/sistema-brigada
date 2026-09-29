-- Dados pessoais passam a valer para qualquer pessoa (aluno, instrutor, equipe), não só aluno.

-- AlterTable
ALTER TABLE "public"."RegistrationRequest" ADD COLUMN     "birthDate" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "public"."PersonProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "birthDate" TIMESTAMP(3),
    "gender" TEXT,
    "baptismDate" TIMESTAMP(3),
    "pioneerStatus" "public"."PioneerStatus",
    "signedPetitions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "profession" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PersonProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PersonProfile_userId_key" ON "public"."PersonProfile"("userId");

-- CreateIndex
CREATE INDEX "PersonProfile_organizationId_idx" ON "public"."PersonProfile"("organizationId");

-- AddForeignKey
ALTER TABLE "public"."PersonProfile" ADD CONSTRAINT "PersonProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Copia os dados pessoais que já existiam no perfil de aluno (mesmo id, um perfil por pessoa).
INSERT INTO "public"."PersonProfile" ("id", "userId", "organizationId", "birthDate", "gender", "baptismDate", "pioneerStatus", "signedPetitions", "profession", "createdAt", "updatedAt")
SELECT "id", "userId", "organizationId", "birthDate", "gender", "baptismDate", "pioneerStatus", "signedPetitions", "profession", "createdAt", "updatedAt"
FROM "public"."StudentProfile";

-- AlterTable
ALTER TABLE "public"."StudentProfile" DROP COLUMN "baptismDate",
DROP COLUMN "birthDate",
DROP COLUMN "gender",
DROP COLUMN "pioneerStatus",
DROP COLUMN "profession",
DROP COLUMN "signedPetitions";
