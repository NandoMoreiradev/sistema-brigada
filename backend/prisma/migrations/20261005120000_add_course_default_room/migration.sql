-- Sala padrão da turma: vem pré-selecionada ao agendar uma aula nova.

-- AlterTable
ALTER TABLE "public"."Course" ADD COLUMN     "defaultRoomId" TEXT;

-- AddForeignKey
ALTER TABLE "public"."Course" ADD CONSTRAINT "Course_defaultRoomId_fkey" FOREIGN KEY ("defaultRoomId") REFERENCES "public"."Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;
