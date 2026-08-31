-- AlterTable
ALTER TABLE "repositories" ADD COLUMN     "health_status" TEXT NOT NULL DEFAULT 'NOT_COMPUTED',
ADD COLUMN     "last_health_computed_at" TIMESTAMP(3),
ADD COLUMN     "last_health_error" TEXT;

-- CreateTable
CREATE TABLE "repository_health_scores" (
    "id" TEXT NOT NULL,
    "repository_id" TEXT NOT NULL,
    "overall_score" INTEGER NOT NULL,
    "security_score" INTEGER NOT NULL,
    "vulnerability_critical_count" INTEGER NOT NULL,
    "vulnerability_high_count" INTEGER NOT NULL,
    "vulnerability_moderate_count" INTEGER NOT NULL,
    "vulnerability_low_count" INTEGER NOT NULL,
    "complexity_score" INTEGER NOT NULL,
    "avg_cyclomatic_complexity" DOUBLE PRECISION NOT NULL,
    "high_complexity_file_count" INTEGER NOT NULL,
    "documentation_score" INTEGER NOT NULL,
    "documented_export_ratio" DOUBLE PRECISION NOT NULL,
    "has_readme" BOOLEAN NOT NULL,
    "activity_score" INTEGER NOT NULL,
    "commits_last_90_days" INTEGER NOT NULL,
    "pr_merge_rate" DOUBLE PRECISION,
    "computed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "repository_health_scores_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "repository_health_scores_repository_id_key" ON "repository_health_scores"("repository_id");

-- AddForeignKey
ALTER TABLE "repository_health_scores" ADD CONSTRAINT "repository_health_scores_repository_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
