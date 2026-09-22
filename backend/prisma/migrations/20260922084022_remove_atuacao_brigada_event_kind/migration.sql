-- Remove o tipo de evento ATUACAO_BRIGADA (decisão do produto: era idêntico a
-- ASSEMBLEIA/CONGRESSO em todo o código — mesma tabela-filha EventOperation, mesmas
-- regras de designação/escala/ocorrência — só um rótulo diferente). Eventos existentes
-- com esse kind são reclassificados como ASSEMBLEIA antes de remover o valor do enum,
-- pra não perder dados.
UPDATE "public"."Event" SET "kind" = 'ASSEMBLEIA' WHERE "kind" = 'ATUACAO_BRIGADA';

-- AlterEnum
BEGIN;
CREATE TYPE "public"."EventKind_new" AS ENUM ('TURMA', 'ASSEMBLEIA', 'CONGRESSO', 'REUNIAO');
ALTER TABLE "public"."Event" ALTER COLUMN "kind" TYPE "public"."EventKind_new" USING ("kind"::text::"public"."EventKind_new");
ALTER TYPE "public"."EventKind" RENAME TO "EventKind_old";
ALTER TYPE "public"."EventKind_new" RENAME TO "EventKind";
DROP TYPE "public"."EventKind_old";
COMMIT;
