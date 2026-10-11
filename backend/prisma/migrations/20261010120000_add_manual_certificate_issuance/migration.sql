-- Emissão manual de certificados por turma: a academia pode desligar a emissão automática,
-- subir o PDF próprio no certificado e avisar o aluno quando quiser.

-- AlterTable
ALTER TABLE "public"."Course" ADD COLUMN     "autoIssueCertificates" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "public"."Certificate" ADD COLUMN     "pdfUploadedManually" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "studentNotifiedAt" TIMESTAMP(3);

-- Os certificados já emitidos avisaram o aluno na emissão.
UPDATE "public"."Certificate" SET "studentNotifiedAt" = "issuedAt";
