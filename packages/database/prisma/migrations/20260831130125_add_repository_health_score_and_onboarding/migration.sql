-- CreateTable
CREATE TABLE "onboarding_guides" (
    "id" TEXT NOT NULL,
    "repository_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NOT_GENERATED',
    "content" TEXT,
    "provider" TEXT,
    "model" TEXT,
    "last_error" TEXT,
    "generated_at" TIMESTAMP(3),

    CONSTRAINT "onboarding_guides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "onboarding_checklist_items" (
    "id" TEXT NOT NULL,
    "onboarding_guide_id" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "is_completed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "onboarding_checklist_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "onboarding_guides_repository_id_key" ON "onboarding_guides"("repository_id");

-- AddForeignKey
ALTER TABLE "onboarding_guides" ADD CONSTRAINT "onboarding_guides_repository_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onboarding_checklist_items" ADD CONSTRAINT "onboarding_checklist_items_onboarding_guide_id_fkey" FOREIGN KEY ("onboarding_guide_id") REFERENCES "onboarding_guides"("id") ON DELETE CASCADE ON UPDATE CASCADE;
