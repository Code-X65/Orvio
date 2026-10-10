# Multi-Branch Inventory Feature Plan

## Goal
Enable multi-branch inventory management where each branch maintains its own stock levels (quantity on hand, reserved) for shared organization-level products. The product catalog is shared across all branches; only stock is branch-scoped. This matches the existing data model (`StockLevel.branch_id`, `Branch` model) and requires wiring up the missing backend CRUD + frontend branch selection.

**Key constraint:** Products and categories remain organization-level (shared across all branches). Stock levels are per-branch. This is the existing architecture — no schema redesign needed.

---

## Current State Assessment

### What already exists
| Component | Status | Location |
|-----------|--------|----------|
| `Branch` Prisma model (id, org_id, name, code, type, status, is_primary, address Json) | ✅ | `schema.prisma:138-159` |
| `StockLevel` model (branch_id + product/variant + qty_on_hand + reserved) | ✅ | `schema.prisma:430-450` |
| `ProductService.listProducts()` supports `query.branchId` filter | ✅ | `products-service.ts:207-228` |
| `ProductService.getProductUsage()` returns per-branch stock breakdown | ✅ | `products-service.ts:598-664` |
| `deleteProduct()` checks reserved/on-hand stock per branch before deletion | ✅ | `products-service.ts:666-744` |
| `deleteCategory()` blocks deletion if children or products exist | ✅ | `categories-service.ts:384-410` |
| Error codes: PRODUCT_HAS_STOCK, PRODUCT_HAS_RESERVED_STOCK, CATEGORY_HAS_PRODUCTS, CANNOT_DELETE_PARENT_CATEGORY | ✅ | `errors.ts:43-46` |
| Onboarding creates primary branch (`completeBranchSetup`) | ✅ | `service.ts:137-225` |
| `InventoryPage` fetches status → passes `branch` + `branches` to workspace | ✅ | `InventoryPage.tsx:118-122` |
| `InventoryWorkspacePage` receives `branches` array + `selectedBranch` state | ✅ | `InventoryWorkspacePage.tsx:49-61` |
| `productApi.listProducts()` accepts `branchId` param | ✅ | `products-api.ts:218` |
| `Product` interface includes `stock_levels: BranchStockItem[]` | ✅ | `products-api.ts:65` |

### What is missing

#### Backend
- **No branch CRUD endpoints** — branch creation only happens via onboarding wizard
- **No `BranchService`** — no list/create/update/delete methods for branches post-onboarding
- **No `branches-routes.ts`** — routes file doesn't exist
- **No branch schemas** — no Zod validation schemas for branch CRUD input
- **Branch model lacks soft-delete** — no `is_deleted`, `deleted_at`, `deleted_by_user_id`, `deleted_reason` fields
- **Branch model lacks `business_type`** — not needed per decision below

#### Frontend
- **No branch selector dropdown** — `selectedBranch` state exists but is never wired to product/category queries
- **`InventoryWorkspacePage` sidebar** shows hardcoded branch info ("Primary Store", "Terminal 01") instead of real data
- **`ProductsPage`** does not accept `branchId` prop — calls `listProducts` without branch context (always shows aggregate)
- **`CategoriesPage`** has no branch context but categories are org-level so this is fine (low priority)
- **No `branches-api.ts`** — frontend API client for branch CRUD
- **"Branch Settings" button** opens placeholder modal (`setActiveModal('Branch Settings')`) with no real CRUD UI
- **Dashboard mock data** — `InventoryWorkspacePage` uses hardcoded arrays (dailyOrdersData, categoriesData, etc.) instead of real branch-scoped data

---

## Decisions

### D1: Shared catalog model (not branch-exclusive products)
- **Decision**: Products and categories are organization-level. Stock is branch-scoped.
- **Rationale**: This is the existing architecture. The `StockLevel` table already joins products to branches. No new tables or migrations needed for the core feature.
- **Implication**: A product created in one branch is visible in all branches; only the stock quantity differs per branch.

### D2: Branch selector in workspace header
- **Decision**: Add a branch dropdown in the top header bar (right side, near currency selector) and keep the sidebar showing the active branch.
- **Rationale**: Standard UX pattern for multi-branch apps. The sidebar space is currently used for the hardcoded "Primary Store" card which should show dynamic data.
- **Implication**: The sidebar card updates to reflect `selectedBranch.name`, `selectedBranch.code`, `selectedBranch.type`.

### D3: Branch selection via query param
- **Decision**: When a branch is selected, the URL updates with `?branch=BRANCH_ID`. The workspace reads this on mount and persists selection via session storage.
- **Rationale**: Allows bookmarking/shareable URLs with a specific branch. Session storage remembers selection per browser tab session.
- **Implication**: `ProductsPage` reads `branchId` from props (passed by workspace) and always includes it in `listProducts` calls.

### D4: Soft-delete on Branch model
- **Decision**: Add `is_deleted`, `deleted_at`, `deleted_by_user_id`, `deleted_reason` fields to the `Branch` Prisma model, consistent with Product and Category.
- **Rationale**: All other inventory entities support soft-delete. Branches should too for audit trail and referential integrity (StockLevels reference branch_id).
- **Implication**: Need a Prisma migration. Existing `service.ts` and other code must be updated to filter `is_deleted: false` where querying branches.

### D5: Branch CRUD scope
- **Decision**: Full CRUD — list, create, read, update, soft-delete. Primary branch enforcement (can't delete the only/primary branch without reassigning).
- **Rationale**: Users need to add/remove branches as their business grows.
- **Implication**: When soft-deleting a branch with active stock, require explicit confirmation with reason (mirroring product deletion pattern).

### D6: Branch Settings as modal (not separate page)
- **Decision**: Implement branch CRUD as a modal dialog triggered from the sidebar "Branch Settings" button, consistent with existing modal patterns in `InventoryWorkspacePage`.
- **Rationale**: The existing code already uses `setActiveModal` for modals. A full page would be over-engineering for branch management.
- **Implication**: Modal shows a form with branch fields (name, code, type, status, address). Delete action requires confirmation.

### D7: Dashboard data
- **Decision**: Replace hardcoded dashboard mock data in `InventoryWorkspacePage` with real branch-scoped API calls. This is a secondary concern — for MVP, keep dashboard static but ensure product/category views are branch-aware.
- **Rationale**: Dashboard requires additional API endpoints (orders, customers, revenue) that don't exist yet. Out of scope for this plan.
- **Implication**: Dashboard mock data stays as-is for now.

---

## Implementation Plan

### Phase 1: Backend — Branch CRUD API

#### Task 1.1: Add soft-delete fields to Branch model
- **File**: `backend/prisma/schema.prisma:138-159`
- Add: `is_deleted Boolean @default(false)`, `deleted_at DateTime?`, `deleted_by_user_id String?`, `deleted_reason String?`
- Run: `npx prisma migrate dev --name add_branch_soft_delete` (after schema edit)
- Update existing `service.ts` queries that select from `branch` to filter `is_deleted: false` where appropriate (line 176, 244, etc.)

#### Task 1.2: Create branch schemas (Zod)
- **File**: `backend/src/modules/inventory/branches-schemas.ts` (new)
- Schemas: `listBranchesQuerySchema`, `createBranchSchema`, `updateBranchSchema`, `deleteBranchQuerySchema`
- Create input: name, code, type (enum: store/warehouse/studio/headquarters), status (enum: active/inactive), address (JSON)
- Update input: all fields optional except requires at least one
- Delete input: reason (required if branch has stock), confirmWithStock (boolean flag)

#### Task 1.3: Create BranchService
- **File**: `backend/src/modules/inventory/branches-service.ts` (new)
- Methods:
  - `listBranches(orgId, query?)` — returns all non-deleted branches for org with stock summary
  - `getBranch(orgId, branchId)` — returns single branch with stock levels
  - `createBranch(orgId, input)` — creates branch, validates org ownership, ensures org has at least one primary
  - `updateBranch(orgId, branchId, input)` — updates branch; if setting is_primary, demotes others
  - `deleteBranch(orgId, branchId, options)` — soft-delete; blocks if has active stock (mirror product deletion pattern); requires `confirmWithStock` + `reason` if stock exists
  - `restoreBranch(orgId, branchId)` — reverses soft-delete
  - `getBranchStock(orgId, branchId)` — returns stock levels for a branch with product details
- All methods use `is_deleted: false` filter on branches
- `createBranch` follows the same pattern as `completeBranchSetup` (service.ts:200-219)
- `updateBranch` handles `is_primary` reassignment (demotes other primaries if needed)

#### Task 1.4: Create branch routes
- **File**: `backend/src/modules/inventory/branches-routes.ts` (new)
- Register under `/api/v1/inventory/branches` prefix
- Routes:
  - `GET /` — list branches (with optional `activeOnly` query param)
  - `POST /` — create branch (owner/admin only)
  - `GET /:id` — get single branch with stock levels
  - `PATCH /:id` — update branch
  - `PATCH /:id/restore` — restore soft-deleted branch
  - `DELETE /:id` — soft-delete branch
- Follow existing pattern from `products-routes.ts` and `categories-routes.ts` (use `@requireAuth`, `@sendData`, Zod validation, try-catch with AppError)
- Add new error codes if needed: `BRANCH_NOT_FOUND`, `BRANCH_HAS_STOCK`, `IS_PRIMARY_BRANCH`, `BRANCH_NOT_ACTIVE`

#### Task 1.5: Register branch routes
- **File**: `backend/src/modules/inventory/routes.ts`
- Add: `app.register(branchRoutes, { prefix: '/branches' });` (line 14, after categories)

### Phase 2: Backend — Update onboarding status to include full branch list

#### Task 2.1: Enhance `getStatus` to exclude soft-deleted branches
- **File**: `backend/src/modules/inventory/service.ts:1-66`
- Current `getStatus` (line ~43) queries `branches: { where: { org_id: orgId } }` — add `is_deleted: false` filter
- Ensure `branch` (active branch) also filters `is_deleted: false`

### Phase 3: Frontend — Branch API client

#### Task 3.1: Create branches-api.ts
- **File**: `frontend/src/features/inventory/branches-api.ts` (new)
- Interface `Branch` (id, name, code, type, status, is_primary, phone, email, address, created_at, updated_at)
- Interface `BranchStockLevel` (product details + stock on hand + reserved per branch)
- `fetchBranches()` — GET `/inventory/branches`
- `createBranch(payload)` — POST `/inventory/branches`
- `updateBranch(id, payload)` — PATCH `/inventory/branches/:id`
- `deleteBranch(id, options)` — DELETE `/inventory/branches/:id`
- `restoreBranch(id)` — PATCH `/inventory/branches/:id/restore`
- `getBranchStock(id)` — GET `/inventory/branches/:id/stock`

#### Task 3.2: Re-export from api.ts
- **File**: `frontend/src/features/inventory/api.ts:112`
- Add: `export * from './branches-api';`

### Phase 4: Frontend — Branch selector in workspace

#### Task 4.1: Add branch selector dropdown to header
- **File**: `frontend/src/pages/app/InventoryWorkspacePage.tsx`
- Replace the static branch display in sidebar (line 298-321) with dynamic `selectedBranch` data
- Add branch selector dropdown in top header bar (next to currency selector)
- Dropdown: lists all `branches`, shows branch type badge, marks primary branch
- On select: `setSelectedBranch(branch)` + update URL query param `?branch=BRANCH_ID`
- Persist selection to `sessionStorage` under key `orvio.selectedBranch.{orgId}`

#### Task 4.2: Pass selectedBranch to ProductsPage
- **File**: `frontend/src/pages/app/InventoryWorkspacePage.tsx:419-423`
- Add `branchId={selectedBranch?.id}` prop to `ProductsPage`
- Add `branchId={selectedBranch?.id}` prop to `CategoriesPage` (informational, since categories are org-level)

#### Task 4.3: Update ProductsPage to accept branchId
- **File**: `frontend/src/features/inventory/components/ProductsPage.tsx:48-57`
- Add `branchId?: string` to `ProductsPageProps`
- Update `fetchProducts` (line 145) to include `branchId` in `listProducts` call
- When `branchId` changes, refetch products

#### Task 4.4: Implement Branch Settings modal
- **File**: `frontend/src/pages/app/InventoryWorkspacePage.tsx`
- Replace placeholder modal (`setActiveModal('Branch Settings')`) with real branch management form
- Modal content: edit form with branch fields (name, code, type, status, address)
- Include "Add Branch" button to create new branches
- Include "Archive Branch" button with confirmation (requires reason if branch has stock)
- Use `branchesApi` functions

### Phase 5: Tests

#### Task 5.1: Backend integration tests
- **File**: `backend/tests/integration/inventory-branches.test.ts` (new)
- Test: list branches returns only non-deleted branches for org
- Test: create branch with valid input
- Test: update branch is_primary demotes other primaries
- Test: soft-delete branch with no stock succeeds
- Test: delete branch with active stock requires confirmation
- Test: delete branch with reserved stock is blocked
- Test: restore soft-deleted branch

#### Task 5.2: Frontend unit tests
- **File**: `frontend/src/features/inventory/branches-api.test.ts` (new)
- Test: `fetchBranches` calls correct endpoint
- Test: `createBranch` sends correct payload
- Test: `deleteBranch` passes confirmWithStock + reason params

### Phase 6: Documentation
- Update `AGENTS.md` if branch commands affect local development workflow

---

## Files Created/Modified Checklist

**New backend files:**
- `backend/src/modules/inventory/branches-schemas.ts`
- `backend/src/modules/inventory/branches-service.ts`
- `backend/src/modules/inventory/branches-routes.ts`
- `backend/tests/integration/inventory-branches.test.ts`
- `prisma/migrations/<timestamp>_add_branch_soft_delete/`

**New frontend files:**
- `frontend/src/features/inventory/branches-api.ts`
- `frontend/src/features/inventory/branches-api.test.ts`

**Modified files:**
- `backend/prisma/schema.prisma` — add soft-delete fields to Branch
- `backend/src/modules/inventory/routes.ts` — register branch routes
- `backend/src/modules/inventory/service.ts` — filter soft-deleted branches in getStatus
- `backend/src/lib/errors.ts` — add BRANCH_NOT_FOUND, BRANCH_HAS_STOCK, etc.
- `frontend/src/features/inventory/api.ts` — re-export branches-api
- `frontend/src/pages/app/InventoryWorkspacePage.tsx` — branch selector, pass to children, real branch settings modal
- `frontend/src/features/inventory/components/ProductsPage.tsx` — accept and use branchId

---

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Existing code assumes Branch has no soft-delete | Audit all `branch.find*` calls and add `is_deleted: false` filter where needed |
| Deleting primary branch breaks onboarding flow | Block deletion of primary branch if it's the only active branch; require reassigning primary first |
| Branch with active stock cannot be deleted | Follow existing `PRODUCT_HAS_STOCK` pattern — require `confirmWithStock` flag + reason |
| URL query param conflicts with other params | Use `branch` as query param name (no conflict with `?page`, `?search`, etc.) |
| Dashboard still uses hardcoded data | Out of scope — dashboard data requires orders/customers APIs that don't exist |

## Validation Plan
1. Run `npx prisma validate` after schema change
2. Run `npm run test` (backend) to verify existing tests pass + new branch tests pass
3. Run `cd frontend && npm run test` to verify frontend tests pass
4. Manual: Create a new branch via modal, verify it appears in selector, verify product list updates to show that branch's stock levels
5. Manual: Soft-delete a branch with stock, verify confirmation is required