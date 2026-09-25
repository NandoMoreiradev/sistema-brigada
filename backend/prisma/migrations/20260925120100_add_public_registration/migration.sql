-- AlterTable
ALTER TABLE "public"."Organization" ADD COLUMN     "publicRegistrationEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "publicRegistrationToken" TEXT,
ADD COLUMN     "publicRegistrationFields" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateIndex
CREATE UNIQUE INDEX "Organization_publicRegistrationToken_key" ON "public"."Organization"("publicRegistrationToken");

-- CreateEnum
CREATE TYPE "public"."RegistrationRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "public"."RegistrationRequest" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "baptismDate" TIMESTAMP(3),
    "pioneerStatus" "public"."PioneerStatus",
    "signedPetitions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "profession" TEXT,
    "status" "public"."RegistrationRequestStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RegistrationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RegistrationRequest_createdUserId_key" ON "public"."RegistrationRequest"("createdUserId");

-- CreateIndex
CREATE INDEX "RegistrationRequest_organizationId_status_idx" ON "public"."RegistrationRequest"("organizationId", "status");

-- AddForeignKey
ALTER TABLE "public"."RegistrationRequest" ADD CONSTRAINT "RegistrationRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RegistrationRequest" ADD CONSTRAINT "RegistrationRequest_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RegistrationRequest" ADD CONSTRAINT "RegistrationRequest_createdUserId_fkey" FOREIGN KEY ("createdUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
