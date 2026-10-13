-- Step 1: Add branch_id as nullable initially
ALTER TABLE "categories" ADD COLUMN "branch_id" TEXT;
ALTER TABLE "brands" ADD COLUMN "branch_id" TEXT;

-- Step 2: Backfill categories to the organization's primary branch
UPDATE "categories" c
SET "branch_id" = (
    SELECT b.id FROM "branches" b
    WHERE b.org_id = c.org_id AND b.is_primary = true
    LIMIT 1
);

-- Fallback for any categories where no primary branch was marked
UPDATE "categories" c
SET "branch_id" = (
    SELECT b.id FROM "branches" b
    WHERE b.org_id = c.org_id
    ORDER BY b.created_at ASC
    LIMIT 1
)
WHERE c.branch_id IS NULL;

-- Step 3: Backfill brands to the organization's primary branch
UPDATE "brands" b
SET "branch_id" = (
    SELECT br.id FROM "branches" br
    WHERE br.org_id = b.org_id AND br.is_primary = true
    LIMIT 1
);

-- Fallback for any brands where no primary branch was marked
UPDATE "brands" b
SET "branch_id" = (
    SELECT br.id FROM "branches" br
    WHERE br.org_id = b.org_id
    ORDER BY br.created_at ASC
    LIMIT 1
)
WHERE b.branch_id IS NULL;

-- Step 4: Delete any orphaned categories/brands whose org had 0 branches (e.g. tests)
DELETE FROM "categories" WHERE "branch_id" IS NULL;
DELETE FROM "brands" WHERE "branch_id" IS NULL;

-- Step 5: Make branch_id NOT NULL
ALTER TABLE "categories" ALTER COLUMN "branch_id" SET NOT NULL;
ALTER TABLE "brands" ALTER COLUMN "branch_id" SET NOT NULL;

-- Step 6: Drop old unique constraints
DROP INDEX IF EXISTS "categories_org_id_slug_key";
DROP INDEX IF EXISTS "brands_org_id_slug_key";

-- Step 7: Create new unique constraints and indexes
CREATE UNIQUE INDEX "categories_org_id_branch_id_slug_key" ON "categories"("org_id", "branch_id", "slug");
CREATE INDEX "categories_branch_id_idx" ON "categories"("branch_id");
CREATE INDEX "categories_org_id_branch_id_idx" ON "categories"("org_id", "branch_id");

CREATE UNIQUE INDEX "brands_org_id_branch_id_slug_key" ON "brands"("org_id", "branch_id", "slug");
CREATE INDEX "brands_branch_id_idx" ON "brands"("branch_id");
CREATE INDEX "brands_org_id_branch_id_idx" ON "brands"("org_id", "branch_id");

-- Step 8: Add Foreign Key constraints
ALTER TABLE "categories" ADD CONSTRAINT "categories_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "brands" ADD CONSTRAINT "brands_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
