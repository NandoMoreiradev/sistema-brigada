-- CreateEnum
CREATE TYPE "public"."RegistrationKind" AS ENUM ('STUDENT', 'INSTRUCTOR', 'STAFF');

-- AlterTable
ALTER TABLE "public"."RegistrationRequest" ADD COLUMN     "accessEmailAt" TIMESTAMP(3),
ADD COLUMN     "accessEmailStatus" TEXT,
ADD COLUMN     "approvedKind" "public"."RegistrationKind",
ADD COLUMN     "inviteId" TEXT,
ADD COLUMN     "requestedKind" "public"."RegistrationKind" NOT NULL DEFAULT 'STUDENT';

-- CreateTable
CREATE TABLE "public"."RegistrationInvite" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "kind" "public"."RegistrationKind" NOT NULL DEFAULT 'STUDENT',
    "token" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "emailStatus" TEXT,
    "emailSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegistrationInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RegistrationInvite_token_key" ON "public"."RegistrationInvite"("token");

-- CreateIndex
CREATE INDEX "RegistrationInvite_organizationId_email_idx" ON "public"."RegistrationInvite"("organizationId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "RegistrationRequest_inviteId_key" ON "public"."RegistrationRequest"("inviteId");

-- AddForeignKey
ALTER TABLE "public"."RegistrationRequest" ADD CONSTRAINT "RegistrationRequest_inviteId_fkey" FOREIGN KEY ("inviteId") REFERENCES "public"."RegistrationInvite"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RegistrationInvite" ADD CONSTRAINT "RegistrationInvite_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RegistrationInvite" ADD CONSTRAINT "RegistrationInvite_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

