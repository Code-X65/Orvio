# Branch Data Separation, Switching Experience & Gateway Entry Plan

## Goal Description
Implement strict **Branch Data Separation** across all inventory entities (Categories, Brands, Products), an authentic **Full-Screen Branch Switching Overlay** that preserves URL route parameters, and a **Multi-Branch Gateway Screen** when accessing the inventory module from the central dashboard.

---

## User Review Required

> [!IMPORTANT]
> **Database Schema Migration (`0007_branch_scoped_categories_and_brands`)**:
> - We will add `branch_id` to `Category` and `Brand` models in [schema.prisma](file:///home/kali/Documents/Orvio/backend/prisma/schema.prisma).
> - All existing categories and brands in the database will be backfilled to their organization's `is_primary = true` branch so no data is lost.
> - Slugs will be unique per branch: `@@unique([org_id, branch_id, slug])`.

> [!TIP]
> **URL & Query Parameter Preservation**:
> - Branch switching will retain the user's active page path (e.g., `/inventory/categories`, `/inventory/products`, `/inventory/brands`) and active filter query parameters (`status`, `search`, etc.), only updating the `branch` parameter.

---

## Architecture & Design Decisions (Resolved via /grill-me)

1. **Strict Branch Isolation**:
   - `Category` and `Brand` models get a `branch_id` foreign key referencing `Branch`.
   - Creating a category or brand is always scoped to the active `branchId`.
   - API endpoints (`GET /inventory/categories`, `GET /inventory/brands`, `GET /inventory/products`) require or filter by `branchId`.
2. **Selective & Clone Import Engine**:
   - `CatalogService` is enhanced to handle importing from an existing branch to a target branch:
     - Categories import (with hierarchy cloning).
     - Brands import.
     - Products import (with variants, images, and price history).
   - In `AddBranchWizardModal`:
     - Option 1: **Start Fresh** (empty catalog).
     - Option 2: **Clone Entire Catalog** (all categories, brands, products).
     - Option 3: **Selective Import** (interactive selection of specific categories, brands, products).
3. **Full-Screen Branch Switching Transition**:
   - A dedicated overlay component `<BranchSwitchingOverlay fromBranch={...} toBranch={...} />`.
   - Displays Orvio aesthetics with `#985184` ambient glow, animated spinner, branch details, and realistic ~800ms loading duration while caches are invalidated and branch data prefetches.
   - Automatically navigates with updated `?branch={newBranchId}` while maintaining current route and secondary query params.
4. **Multi-Branch Gateway Entry**:
   - In `InventoryPage.tsx`:
     - If the organization has **1 branch**: instantly navigates to that branch workspace.
     - If the organization has **2+ branches** and no `?branch=` param is specified in the URL: renders the `<BranchGatewayScreen />` showing branch cards (type, code, primary status, quick actions) allowing the user to select which branch workspace to open.

---

## Proposed Changes

Grouped by component layer:

### 1. Database & Migrations (`backend/prisma`)

#### [MODIFY] [schema.prisma](file:///home/kali/Documents/Orvio/backend/prisma/schema.prisma)
- Add `branch_id String` to `model Category` and `model Brand`.
- Add relation `branch Branch @relation(fields: [branch_id], references: [id], onDelete: Cascade)`.
- Update unique constraints:
  - `Category`: `@@unique([org_id, branch_id, slug])`
  - `Brand`: `@@unique([org_id, branch_id, slug])`
- Add indexes on `[org_id, branch_id]`.

#### [NEW] `backend/prisma/migrations/0007_branch_scoped_categories_and_brands/migration.sql`
- Add `branch_id` columns with backfill to each organization's primary branch (`is_primary = true` or `min(created_at)`).
- Alter table constraints and unique indexes.

---

### 2. Backend Services & Schemas (`backend/src/modules/inventory`)

#### [MODIFY] [categories-schemas.ts](file:///home/kali/Documents/Orvio/backend/src/modules/inventory/categories-schemas.ts)
- Add `branchId` to query schemas and create payload.

#### [MODIFY] [categories-service.ts](file:///home/kali/Documents/Orvio/backend/src/modules/inventory/categories-service.ts)
- Filter `getCategories` and `buildCategoryTree` by `branch_id`.
- Scope category creation, update, and hierarchy validation to `branch_id`.

#### [MODIFY] [brands-schemas.ts](file:///home/kali/Documents/Orvio/backend/src/modules/inventory/brands-schemas.ts)
- Add `branchId` to query schemas and create payload.

#### [MODIFY] [brands-service.ts](file:///home/kali/Documents/Orvio/backend/src/modules/inventory/brands-service.ts)
- Filter `getBrands` by `branch_id`.
- Scope brand creation and operations to `branch_id`.

#### [MODIFY] [catalog-service.ts](file:///home/kali/Documents/Orvio/backend/src/modules/inventory/catalog-service.ts)
- Extend `importCatalog` to support:
  - `categoryIds`: clones selected categories (preserving hierarchy) into target branch.
  - `brandIds`: clones selected brands into target branch.
  - `productIds` / `mode: 'all'`: clones products linked to the corresponding target branch categories and brands.

#### [MODIFY] [branches-service.ts](file:///home/kali/Documents/Orvio/backend/src/modules/inventory/branches-service.ts)
- In `createBranch`: if `catalogSetup` is provided (`clone` or `selective`), invoke `catalogService.importCatalog` atomically or sequentially.

---

### 3. Frontend API Clients & Hooks (`frontend/src`)

#### [MODIFY] [categories-api.ts](file:///home/kali/Documents/Orvio/frontend/src/features/inventory/categories-api.ts) & [useCategories.ts](file:///home/kali/Documents/Orvio/frontend/src/features/inventory/hooks/useCategories.ts)
- Accept `branchId?: string`.
- Update React Query key to `['inventory', 'categories', { branchId }]`.

#### [MODIFY] [brands-api.ts](file:///home/kali/Documents/Orvio/frontend/src/features/inventory/brands-api.ts) & [useBrands.ts](file:///home/kali/Documents/Orvio/frontend/src/features/inventory/hooks/useBrands.ts)
- Accept `branchId?: string`.
- Update React Query key to `['inventory', 'brands', { branchId, activeOnly }]`.

---

### 4. Frontend UI Components (`frontend/src`)

#### [NEW] `frontend/src/components/ui/BranchSwitchingOverlay.tsx`
- Full-screen animated transition with Orvio dark palette (`#111215`, `#181a20`), ambient violet glow (`#985184`), loader, and clear messaging:
  - `Switching from [Branch A] to [Branch B]...`
  - Shows branch types, location details, and a progress indicator.

#### [NEW] `frontend/src/features/inventory/components/BranchGatewayScreen.tsx`
- Branded entry screen rendered when user enters `/inventory` and org has multiple branches.
- Shows list of available branch cards with:
  - Branch name, code badge, primary badge, type (Store/Warehouse), contact info.
  - "Open Branch" button leading directly to `/inventory/products?branch={id}`.
  - Quick action to "Create New Branch".

#### [MODIFY] [InventoryPage.tsx](file:///home/kali/Documents/Orvio/frontend/src/pages/app/InventoryPage.tsx)
- Evaluate branch count and URL parameters:
  - If URL has `?branch={id}`: render `InventoryWorkspacePage` for that branch.
  - If URL has no `?branch=` param and `branches.length === 1`: automatically load the single branch.
  - If URL has no `?branch=` param and `branches.length > 1`: render `<BranchGatewayScreen />`.

#### [MODIFY] [InventoryWorkspacePage.tsx](file:///home/kali/Documents/Orvio/frontend/src/pages/app/InventoryWorkspacePage.tsx)
- Integrate `<BranchSwitchingOverlay />` on branch switch.
- Update `handleSelectBranchId` to:
  - Activate switching overlay state.
  - Preserve current pathname (`/inventory/categories`, `/inventory/products`, `/inventory/brands`, etc.) and all existing search parameters while replacing `branch`.
  - Pass `selectedBranchId` down to `CategoriesPage` and `BrandsPage`.

#### [MODIFY] [CategoriesPage.tsx](file:///home/kali/Documents/Orvio/frontend/src/features/inventory/components/CategoriesPage.tsx) & [BrandsPage.tsx](file:///home/kali/Documents/Orvio/frontend/src/features/inventory/components/BrandsPage.tsx)
- Pass `branchId` to `useCategories({ branchId })` and `useBrands({ branchId })`.
- Ensure new categories and brands created inside the drawer inherit the current `branchId`.

#### [MODIFY] [AddBranchWizardModal.tsx](file:///home/kali/Documents/Orvio/frontend/src/features/inventory/components/AddBranchWizardModal.tsx)
- Add Step 3: "Catalog Setup":
  - Radio options:
    1. **Start Fresh**: Empty catalog for this branch.
    2. **Clone Entire Catalog**: Select existing branch $\to$ duplicate all categories, brands, and products.
    3. **Selective Import**: Select source branch $\to$ interactive checklist of categories, brands, and products to import.

---

## Verification Plan

### Automated Tests
1. **Prisma Migrations**:
   - `npx prisma migrate dev` / test execution verifying constraint validity and backfills.
2. **Backend Unit & Integration Tests**:
   - Run `npx vitest run tests/integration/inventory-categories.test.ts`
   - Run `npx vitest run tests/integration/inventory-brands.test.ts`
   - Run `npx vitest run tests/integration/inventory-catalog.test.ts`
   - Run `npx vitest run tests/integration/websocket-auth.test.ts tests/integration/websocket-broadcast.test.ts`
3. **Frontend Tests**:
   - `npm run typecheck` (`tsc -b`)
   - `npm test` (Vitest test suite)

### Manual Verification
1. **Branch Gateway**: Navigate to `/dashboard` $\to$ click Inventory. With 2+ branches, verify the gateway screen appears. Click a branch $\to$ enter that branch workspace.
2. **Branch Switching Overlay**: From the top header dropdown, pick another branch. Verify the full-screen overlay appears with "Switching from [Branch A] to [Branch B]...", URL updates `?branch=...`, and the active page (Categories/Brands/Products) stays selected.
3. **Data Separation**:
   - In Branch A: create Category "Branch A Drinks" and Brand "Brand Alpha".
   - Switch to Branch B: verify neither Category "Branch A Drinks" nor "Brand Alpha" appears in Branch B.
4. **New Branch Wizard Import**:
   - Create a new Branch C using the wizard with "Selective Import".
   - Select "Branch A Drinks".
   - Verify Branch C now contains only the selected category.
