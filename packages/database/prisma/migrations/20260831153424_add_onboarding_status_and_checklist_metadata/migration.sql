/*
  Warnings:

  - The `status` column on the `onboarding_guides` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - A unique constraint covering the columns `[onboarding_guide_id,key]` on the table `onboarding_checklist_items` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `key` to the `onboarding_checklist_items` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "OnboardingGuideStatus" AS ENUM ('NOT_GENERATED', 'GENERATING', 'GENERATED', 'FAILED');

-- AlterTable
ALTER TABLE "onboarding_checklist_items" ADD COLUMN     "category" TEXT,
ADD COLUMN     "completed_at" TIMESTAMP(3),
ADD COLUMN     "key" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "onboarding_guides" DROP COLUMN "status",
ADD COLUMN     "status" "OnboardingGuideStatus" NOT NULL DEFAULT 'NOT_GENERATED';

-- CreateIndex
CREATE INDEX "onboarding_checklist_items_onboarding_guide_id_order_idx" ON "onboarding_checklist_items"("onboarding_guide_id", "order");

-- CreateIndex
CREATE UNIQUE INDEX "onboarding_checklist_items_onboarding_guide_id_key_key" ON "onboarding_checklist_items"("onboarding_guide_id", "key");
