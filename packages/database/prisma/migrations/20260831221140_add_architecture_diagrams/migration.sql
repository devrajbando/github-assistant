-- CreateTable
CREATE TABLE "architecture_diagrams" (
    "id" TEXT NOT NULL,
    "repository_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "summary" TEXT,
    "mermaid_code" TEXT,
    "source_index_run_id" TEXT,
    "provider" TEXT,
    "model" TEXT,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "architecture_diagrams_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "architecture_diagrams" ADD CONSTRAINT "architecture_diagrams_repository_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
