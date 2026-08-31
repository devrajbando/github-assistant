-- CreateTable
CREATE TABLE "code_chunks" (
    "id" TEXT NOT NULL,
    "repository_id" TEXT NOT NULL,
    "file_path" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" vector(768) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "code_chunks_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "code_chunks" ADD CONSTRAINT "code_chunks_repository_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex (HNSW for cosine-distance similarity search — Prisma schema can't declare vector indexes yet, hand-added here)
CREATE INDEX "code_chunks_embedding_hnsw_idx" ON "code_chunks" USING hnsw ("embedding" vector_cosine_ops);

-- CreateIndex (speeds up delete-and-recreate on re-index, and any repo-scoped lookups)
CREATE INDEX "code_chunks_repository_id_idx" ON "code_chunks" ("repository_id");
