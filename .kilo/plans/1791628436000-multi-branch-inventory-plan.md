# Brand Management & Unified Catalog for Multi-Branch Inventory

## Status
- **Multi-branch inventory (Phase 0)**: COMPLETE — Branch model, BranchService, branches-routes/schemas/service, branches-api, BranchManagementModal, AddBranchWizardModal, multi-branch wiring in InventoryWorkspacePage and ProductsPage all implemented and tested.
- **Visual assets**: COMPLETE — ProductImage, ImageUploader, ProductGallery, VariantSwatchSelector, CategoryImageBadge all implemented.
- **Brand Management & Unified Catalog (Phases 1-7)**: COMPLETE — Brand, BranchProduct, CatalogImport models, Prisma migrations (0005 & 0006 backfill), BrandService & routes, CatalogService & routes, ProductService brand integration, Frontend Brand CRUD & BrandForm, CatalogImportModal 4-step wizard, BranchCatalogModal, CatalogImportHistory, ProductsPage brand column & catalog actions, InventoryWorkspacePage /inventory/brands routing & nav. All backend and frontend typechecks and tests passing.

## Goal
Introduce a first-class **Brand** entity, integrate it into the existing Category → Product → Variant hierarchy as a **unified catalog**, enable **per-branch catalog assignments** via a `BranchProduct` membership table, and provide **catalog import** between branches with audit logging.

## Model Decisions

### D1: Brands are org-level (shared across branches)
- Brand is a master entity at the organization level. All branches see the same brand list.
- Rationale: Brands represent manufacturers/publishers — consistent across all locations.
- Impact: No branch-level brand CRUD needed; simplifies import (brands come along with products).

### D2: Products are org-level masters, branches have catalog assignments
- Product/Brand/Category = org-level master data (already exists for Product/Category).
- New `BranchProduct` table defines which products appear in each branch's catalog.
- A product's `brand_id` is org-level; stock levels remain per-branch via existing `StockLevel`.

### D3: Catalog import creates BranchProduct + optional StockLevel
- Importing from Branch A → B: creates `BranchProduct` entries in B with `source_branch_id = A`.
- Optional: copy stock levels from A to B (creates `StockLevel` entries in B).
- Default: import with zero stock (must be explicitly opted in).
- Brand/category associations come automatically (org-level shared).

### D4: Soft-delete pattern everywhere (consistent with Product/Category/Branch)
- Brand: `is_deleted`, `deleted_at`, `deleted_by_user_id`, `deleted_reason`
- BranchProduct: `is_excluded` (soft-remove from catalog without breaking provenance)
- No hard deletes for Brands or BranchProduct entries.

### D5: Brand backfill from metadata
- Existing products store brand as free-text in `metadata.brand`.
- Migration extracts unique brand names → creates Brand records → sets `product.brand_id`.
- Unmatched/empty: linked to auto-generated "Unorganized" brand (inactive, not user-facing).

## Data Structures

### New: Brand
```prisma
model Brand {
  id                 String    @id @default(cuid())
  org_id             String
  name               String
  slug               String?
  description        String?   @db.Text
  logo_url           String?
  website_url        String?
  is_active          Boolean   @default(true)
  is_deleted         Boolean   @default(false)
  deleted_at         DateTime?
  deleted_by_user_id String?
  deleted_reason     String?   @db.Text
  sort_order         Int       @default(0)
  metadata           Json?
  created_at         DateTime  @default(now())
  updated_at         DateTime  @updated_at

  organization       Organization @relation(fields: [org_id], references: [id], onDelete: Cascade)
  products           Product[]

  @@unique([org_id, slug])
  @@index([org_id, is_deleted])
  @@index([org_id, is_active])
  @@map("brands")
}
```

### Modified: Product (add brand_id)
- Add: `brand_id String?` → `brand Brand? @relation(fields: [brand_id], references: [id], onDelete: SetNull)`
- Add: `branch_assignments BranchProduct[]` (reverse relation)

### Modified: ProductVariant (Phase 2 — add brand_id)
- Add: `brand_id String?` → `brand Brand? @relation(...)` (variant-specific brand override)

### New: BranchProduct
```prisma
model BranchProduct {
  id                    String     @id @default(cuid())
  org_id                String
  branch_id             String
  product_id            String
  source_branch_id      String?    // null = native to this branch; set = imported
  added_by_user_id      String?
  added_at              DateTime   @default(now())
  notes                 String?    @db.Text
  is_excluded           Boolean    @default(false)

  organization          Organization @relation(fields: [org_id], references: [id], onDelete: Cascade)
  branch                Branch          @relation(fields: [branch_id], references: [id], onDelete: Cascade)
  product               Product         @relation(fields: [product_id], references: [id], onDelete: Cascade)
  source_branch         Branch?         @relation("BranchProductSource", fields: [source_branch_id], references: [id])
  user                  User?           @relation("BranchProductAddedBy", fields: [added_by_user_id], references: [id])

  @@unique([org_id, branch_id, product_id])
  @@index([branch_id])
  @@index([product_id])
  @@index([source_branch_id])
  @@map("branch_products")
}
```

### New: CatalogImport (audit log)
```prisma
model CatalogImport {
  id                String    @id @default(cuid())
  org_id            String
  source_branch_id  String
  target_branch_id  String
  imported_by_user_id String?
  product_count     Int
  copy_stock        Boolean   @default(false)
  notes             String?
  created_at        DateTime  @default(now())

  source_branch     Branch          @relation("ImportSource", fields: [source_branch_id], references: [id])
  target_branch     Branch          @relation("ImportTarget", fields: [target_branch_id], references: [id])
  user              User?           @relation(fields: [imported_by_user_id], references: [id])

  @@index([org_id])
  @@index([target_branch_id])
  @@map("catalog_imports")
}
```

### Modified: Branch (add relations)
- Add: `branch_products BranchProduct[]` (reverse)
- Add: `import_audits_imported CatalogImport[]` (reverse — imports INTO this branch)

## Backend Implementation Plan

### Phase 1 — Schema & Migrations
- **P1.0** Update `schema.prisma`: Add Brand, BranchProduct, CatalogImport models; add `brand_id` to Product; add `branch_products` + `import_audits_imported` relations to Branch
- **P1.1** Migration 1: `add_brand_and_catalog_models`
- **P1.2** Migration 2: `backfill_brands_from_metadata` — extract `metadata.brand` → Brand records + `product.brand_id`
- **P1.3** Add error codes to `errors.ts`: `BRAND_NOT_FOUND`, `BRAND_SLUG_DUPLICATE`, `BRAND_HAS_PRODUCTS`, `BRANCH_PRODUCT_NOT_FOUND`, `CATALOG_IMPORT_FAILED`

### Phase 2 — Brand CRUD
- **P2.1** `backend/src/modules/inventory/brands-schemas.ts` — Zod: createBrandSchema, updateBrandSchema, listBrandsQuerySchema, deleteBrandQuerySchema
- **P2.2** `backend/src/modules/inventory/brands-service.ts` — BrandService: listBrands, getBrand, createBrand, updateBrand, deleteBrand (soft), restoreBrand, listBrandProducts
- **P2.3** `backend/src/modules/inventory/brands-routes.ts` — Fastify routes: GET/POST/GET-by-id/PATCH/DELETE/PATCH-restore
- **P2.4** Register `brandRoutes` in `routes.ts` under `/brands` prefix

### Phase 3 — Catalog Service & Routes
- **P3.1** `backend/src/modules/inventory/catalog-schemas.ts` — Zod: assignProductSchema, importCatalogSchema, listBranchProductsQuerySchema
- **P3.2** `backend/src/modules/inventory/catalog-service.ts` — CatalogService:
  - `listBranchProducts(orgId, branchId, query)` — join BranchProduct → Product with brand/category info
  - `assignProductToBranch(orgId, branchId, productId, userId, notes)` — create BranchProduct
  - `removeProductFromBranch(orgId, branchId, productId)` — set `is_excluded = true`
  - `importCatalog(orgId, sourceBranchId, targetBranchId, productIds, options, userId)` — transaction creating BranchProduct[] + optional StockLevel[], CatalogImport record
  - `getBranchCatalogSummary(orgId, branchId)` — counts, categories, brands
- **P3.3** `backend/src/modules/inventory/catalog-routes.ts` — Routes:
  - `GET /branches/:branchId/products` — list branch catalog
  - `POST /branches/:branchId/products` — assign product to catalog
  - `DELETE /branches/:branchId/products/:productId` — remove from catalog
  - `POST /branches/:branchId/catalog/import` — import from source branch
  - `GET /branches/:branchId/catalog/summary` — catalog overview
  - `GET /catalog-imports` — import history for org
- **P3.4** Register `catalogRoutes` in `routes.ts` under `/catalog` prefix

### Phase 4 — ProductService Integration
- **P4.1** Update `products-schemas.ts`: add `brandId` to create/update/list query schemas; add `includeExcluded` to list query
- **P4.2** Update `products-service.ts`:
  - `createProduct`: when `branchId` provided, create BranchProduct entry
  - `updateProduct`: handle `brandId` field
  - `listProducts`: when `branchId` provided, join through BranchProduct to filter catalog
  - Include `brand` in product detail/list responses (join)
- **P4.3** Add to existing image/upload integration (ProductService already handles ProductImage — ensure variant images respect brand context if applicable)

## Frontend Implementation Plan

### Phase 5 — Brand API & Pages
- **P5.1** `frontend/src/features/inventory/brands-api.ts` — Brand interface, fetchBrands, createBrand, updateBrand, deleteBrand, restoreBrand
- **P5.2** `frontend/src/features/inventory/components/BrandsPage.tsx` — table view (name, slug, logo, product count, status), archive/restore actions, "Add Brand" button
- **P5.3** `frontend/src/features/inventory/components/BrandForm.tsx` — modal form: name*, slug (auto), logo (ImageUploader), description, website, metadata. Use CategoryImageBadge pattern for logo display.
- **P5.4** Modify `ProductForm.tsx` — replace free-text `brand` metadata field with `<select>` from `brandsApi.fetchBrands()` + "Create new brand" quick link
- **P5.5** Modify `InventoryWorkspacePage.tsx` — add "Brands" to navItems[]
- **P5.6** Modify `api.ts` — re-export `brands-api`

### Phase 6 — Catalog Import UI
- **F6.1** `frontend/src/features/inventory/catalog-api.ts` — BranchProduct interface, importCatalog, assignProductToBranch, removeProductFromBranch, getBranchCatalogSummary, getCatalogImports
- **F6.2** `frontend/src/features/inventory/components/CatalogImportModal.tsx` — 4-step wizard:
  1. Select source branch (dropdown, excluding current branch)
  2. Select products (checkbox tree: category → brand → products; search, select all/invert)
  3. Options (copy stock toggle, overwrite existing toggle, note textarea)
  4. Preview + confirm (summary: product count, categories, brands, import mode)
- **F6.3** `frontend/src/features/inventory/components/BranchCatalogModal.tsx` — manage branch catalog: Assigned Products tab (list with remove action), Import Catalog button
- **F6.4** `frontend/src/features/inventory/components/CatalogImportHistory.tsx` — audit log table (source/target branch, product count, date, user, notes)

### Phase 7 — Integration & Polish
- **F7.1** Modify `ProductsPage.tsx` — add Brand column (badge with logo), import-source indicator, "Remove from Catalog" action in row menu
- **F7.2** Modify `BranchManagementModal.tsx` — add "Import Catalog" + "Manage Catalog" buttons
- **F7.3** Modify `api.ts` — re-export `catalog-api`
- **F7.4** Update `InventoryWorkspacePage` dashboard to use real category/brand data (currently hardcoded mock arrays)

## User Workflows

### Workflow A: Brand Creation
```
BrandsPage → "Add Brand" → BrandForm modal → name, slug, logo, description → Save
→ POST /inventory/brands → Brand appears in list with product_count=0
```

### Workflow B: Product with Brand
```
ProductsPage (branch view) → "New Product" → ProductForm
→ Brand dropdown (fetched from GET /brands) + "Create new brand" link
→ Save → Product.brand_id set → BranchProduct created for current branch
```

### Workflow C: Per-Branch Catalog View
```
Select Branch B → URL ?branch=B → ProductsPage refetches with branchId=B
→ Backend joins BranchProduct WHERE branch_id=B, is_excluded=false
→ Only assigned products shown, each with brand badge + stock level
```

### Workflow D: Catalog Import
```
Branch B catalog view → "Import Catalog" → CatalogImportModal
Step 1: Select Branch A as source
Step 2: Checkbox-select products (grouped by category → brand)
Step 3: Toggle stock copy (default off), add note
Step 4: Preview → Import
→ POST /catalog/branches/B/catalog/import
→ BranchProduct[] created (source_branch_id=A)
→ StockLevel[] created (if copy_stock)
→ CatalogImport record logged
→ ProductsPage refreshes showing new catalog entries
```

### Workflow E: Remove from Branch Catalog
```
Product row → ⋮ → "Remove from Catalog"
→ Confirmation dialog → DELETE /catalog/branches/B/products/PRODUCT_ID
→ Sets is_excluded=true (product stays in org, StockLevel preserved)
```

### Workflow F: Brand Backfill (migration)
```
1. Collect all metadata.brand values across orgs
2. Create Brand records (slugified names, "Unorganized" fallback)
3. Set product.brand_id to matching Brand
4. Log migration stats
```

## Edge Cases & Mitigations

| Scenario | Handling |
|-----------|----------|
| Product already in target catalog (import) | Skip with warning row; "overwrite" checkbox resets stock to source values |
| Source branch has 0 catalog products | Show empty state in import step 2 |
| Source branch has variants | Auto-include all variants of selected parent product |
| Product archived (soft-deleted) | Excluded from import by default; toggle to include |
| Import with stock copy + existing target stock | Overwrite toggle; default: sum or warn |
| Brand with existing products → archive | Soft-delete only; products retain brand_id, brand displays as "(archived)" |
| Slug conflict on brand creation | Append `-2`, `-3` etc. (same pattern as category slug) |
| Deleting only branch with catalog | Blocked by existing CANNOT_DELETE_ONLY_BRANCH logic |

## Cache Invalidation
- Brand CRUD → clear `brands_list:{orgId}`
- BranchProduct changes → clear `branch_products:{orgId}:{branchId}` + `products_list:{orgId}`
- Catalog import → clear source + target branch caches + products_list

## Authorization Rules
- owner, admin: brand CRUD, branch catalog management, catalog import
- manager: manage branch catalogs, initiate imports
- staff: read-only catalog + stock view

## Reuse Opportunities
- **ImageUploader** — brand logo upload (already built)
- **CategoryImageBadge** — brand logo display badge pattern
- **BranchManagementModal** — UI patterns for branch list/edit/archive
- **AddBranchWizardModal** — multi-step modal pattern for CatalogImportModal
- **Error code patterns** — mirror `BRANCH_HAS_STOCK` / `PRODUCT_HAS_STOCK` for `BRAND_HAS_PRODUCTS`
- **Soft-delete pattern** — consistent across Product/Category/Branch → apply to Brand
- **Cache pattern** — `inventoryCache` with `fetchOrCompute` + `clearPrefix`

## Validation Plan
1. `npx prisma validate` after schema changes
2. Backend: `npm run test` — existing + new brand/catalog integration tests pass
3. Frontend: `cd frontend && npm run test` — all pass
4. E2E: Create brand → Create product with brand → Assign to Branch A → Import to Branch B → Verify BranchProduct + StockLevel + CatalogImport
5. E2E: Brand backfill migration → Verify metadata.brand → Brand records → product.brand_id
6. E2E: Remove product from catalog → Verify is_excluded=true, catalog list excludes it

## Files Created/Modified Checklist

### New Backend Files
| File | Purpose |
|---|---|
| `backend/src/modules/inventory/brands-schemas.ts` | Zod validation for brands |
| `backend/src/modules/inventory/brands-service.ts` | BrandService class |
| `backend/src/modules/inventory/brands-routes.ts` | Fastify brand routes |
| `backend/src/modules/inventory/catalog-schemas.ts` | Zod validation for catalog operations |
| `backend/src/modules/inventory/catalog-service.ts` | CatalogService class |
| `backend/src/modules/inventory/catalog-routes.ts` | Fastify catalog import routes |
| `backend/tests/integration/inventory-brands.test.ts` | Brand CRUD integration tests |
| `backend/tests/integration/inventory-catalog.test.ts` | Catalog import integration tests |
| `prisma/migrations/add_brand_and_catalog_models/` | Schema migration |
| `prisma/migrations/backfill_brands_from_metadata/` | Data migration |

### New Frontend Files
| File | Purpose |
|---|---|
| `frontend/src/features/inventory/brands-api.ts` | Brand API client |
| `frontend/src/features/inventory/catalog-api.ts` | Catalog API client |
| `frontend/src/features/inventory/brands-api.test.ts` | Brand API unit tests |
| `frontend/src/features/inventory/components/BrandsPage.tsx` | Brand list page |
| `frontend/src/features/inventory/components/BrandForm.tsx` | Brand create/edit form |
| `frontend/src/features/inventory/components/CatalogImportModal.tsx` | 4-step import wizard |
| `frontend/src/features/inventory/components/BranchCatalogModal.tsx` | Branch catalog management |
| `frontend/src/features/inventory/components/CatalogImportHistory.tsx` | Import audit log view |

### Modified Files
| File | Change |
|---|---|
| `backend/prisma/schema.prisma` | Add Brand, BranchProduct, CatalogImport models; brand_id on Product; branch_products relation on Branch |
| `backend/src/modules/inventory/routes.ts` | Register brandRoutes + catalogRoutes |
| `backend/src/lib/errors.ts` | Add 5 new error codes |
| `backend/src/modules/inventory/products-service.ts` | brand_id handling, BranchProduct join in listProducts, create BranchProduct on product creation |
| `backend/src/modules/inventory/products-schemas.ts` | brandId in create/update schemas, includeExcluded in list query |
| `frontend/src/features/inventory/api.ts` | Re-export brands-api + catalog-api |
| `frontend/src/features/inventory/components/ProductForm.tsx` | Brand dropdown replacing free-text field |
| `frontend/src/features/inventory/components/ProductsPage.tsx` | Brand column, import-source badge, remove-from-catalog action |
| `frontend/src/pages/app/InventoryWorkspacePage.tsx` | Brands nav item, dashboard real data |
| `frontend/src/features/inventory/components/BranchManagementModal.tsx` | Import Catalog + Manage Catalog buttons |

## Out of Scope
- Variant-level brand assignment (Phase 2 enhancement)
- Branch-specific category trees (categories remain org-level, shared)
- Real-time dashboard data replacement (dashboard mock data stays as-is for MVP)
- Multi-brand products (a product maps to one brand; use metadata for secondary attributes)
