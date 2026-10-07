-- Nome do curso no certificado e carga horária (variáveis {{curso.nome}} e {{curso.cargaHoraria}}).

-- AlterTable
ALTER TABLE "public"."Course" ADD COLUMN     "certificateTitle" TEXT,
ADD COLUMN     "workloadHours" INTEGER;

