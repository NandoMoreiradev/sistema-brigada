-- CreateEnum
CREATE TYPE "public"."PioneerStatus" AS ENUM ('AUXILIARY', 'REGULAR');

-- AlterTable
ALTER TABLE "public"."StudentProfile" ADD COLUMN     "baptismDate" TIMESTAMP(3),
ADD COLUMN     "pioneerStatus" "public"."PioneerStatus",
ADD COLUMN     "profession" TEXT,
ADD COLUMN     "signedPetitions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
