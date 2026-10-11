-- AlterTable
ALTER TABLE "branches" ADD COLUMN "is_deleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "deleted_at" TIMESTAMP(3),
ADD COLUMN "deleted_by_user_id" TEXT,
ADD COLUMN "deleted_reason" TEXT;

-- CreateIndex
CREATE INDEX "branches_org_id_is_deleted_idx" ON "branches"("org_id", "is_deleted");
