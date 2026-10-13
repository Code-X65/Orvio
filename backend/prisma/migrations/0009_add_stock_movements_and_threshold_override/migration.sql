-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "stock_movement_type" AS ENUM ('opening', 'receipt', 'adjustment', 'transfer_out', 'transfer_in', 'sale', 'sale_void');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "stock_adjustment_reason" AS ENUM ('damage', 'loss', 'found', 'correction', 'count_reconciliation', 'other');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- AlterTable
ALTER TABLE "stock_levels" ADD COLUMN IF NOT EXISTS "low_stock_threshold" INTEGER;

-- CreateTable
CREATE TABLE IF NOT EXISTS "stock_movements" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "variant_id" TEXT,
    "movement_type" "stock_movement_type" NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "balance_before" DECIMAL(14,3) NOT NULL,
    "balance_after" DECIMAL(14,3) NOT NULL,
    "reason" "stock_adjustment_reason",
    "reference_id" TEXT,
    "actor_id" TEXT,
    "notes" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "stock_movements_org_id_branch_id_idx" ON "stock_movements"("org_id", "branch_id");
CREATE INDEX IF NOT EXISTS "stock_movements_org_id_product_id_idx" ON "stock_movements"("org_id", "product_id");
CREATE INDEX IF NOT EXISTS "stock_movements_org_id_movement_type_idx" ON "stock_movements"("org_id", "movement_type");
CREATE INDEX IF NOT EXISTS "stock_movements_org_id_created_at_idx" ON "stock_movements"("org_id", "created_at");
CREATE INDEX IF NOT EXISTS "stock_movements_reference_id_idx" ON "stock_movements"("reference_id");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
