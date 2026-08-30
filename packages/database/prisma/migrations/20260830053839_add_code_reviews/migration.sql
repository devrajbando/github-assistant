-- CreateTable
CREATE TABLE "code_reviews" (
    "id" TEXT NOT NULL,
    "pull_request_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "summary" TEXT,
    "provider" TEXT,
    "model" TEXT,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "code_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "code_review_findings" (
    "id" TEXT NOT NULL,
    "code_review_id" TEXT NOT NULL,
    "file_path" TEXT NOT NULL,
    "line_number" INTEGER,
    "severity" TEXT NOT NULL,
    "comment" TEXT NOT NULL,

    CONSTRAINT "code_review_findings_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "code_reviews" ADD CONSTRAINT "code_reviews_pull_request_id_fkey" FOREIGN KEY ("pull_request_id") REFERENCES "pull_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "code_review_findings" ADD CONSTRAINT "code_review_findings_code_review_id_fkey" FOREIGN KEY ("code_review_id") REFERENCES "code_reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;
