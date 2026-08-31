/*
  Warnings:

  - The `health_status` column on the `repositories` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "HealthStatus" AS ENUM ('NOT_COMPUTED', 'COMPUTING', 'COMPUTED', 'FAILED');

-- AlterTable
ALTER TABLE "repositories" DROP COLUMN "health_status",
ADD COLUMN     "health_status" "HealthStatus" NOT NULL DEFAULT 'NOT_COMPUTED';
