-- AlterTable
ALTER TABLE "public"."Organization" ADD COLUMN     "publicRegistrationFieldsInstructor" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "publicRegistrationFieldsStaff" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Até aqui a mesma lista valia para todos os papéis: instrutor e equipe começam com a lista atual,
-- então nada muda no formulário de nenhuma academia até ela configurar por papel.
UPDATE "public"."Organization"
SET "publicRegistrationFieldsInstructor" = "publicRegistrationFields",
    "publicRegistrationFieldsStaff" = "publicRegistrationFields";
