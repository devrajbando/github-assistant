/*
  Warnings:

  - Added the required column `index_run_id` to the `code_chunks` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "code_chunks_embedding_hnsw_idx";

-- DropIndex
DROP INDEX "code_chunks_repository_id_idx";

-- AlterTable
ALTER TABLE "code_chunks" ADD COLUMN     "index_run_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "repositories" ADD COLUMN     "active_index_run_id" TEXT,
ADD COLUMN     "index_status" TEXT NOT NULL DEFAULT 'NOT_INDEXED',
ADD COLUMN     "last_index_error" TEXT,
ADD COLUMN     "last_indexed_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "code_chunks_repository_id_index_run_id_idx" ON "code_chunks"("repository_id", "index_run_id");
