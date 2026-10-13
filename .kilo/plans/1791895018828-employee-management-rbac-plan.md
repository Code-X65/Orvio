# Employee Management (RBAC + Multi-Branch) — Implementation Plan

## Goal
Implement an Employee Management capability on top of Orvio's inventory module so that an **Owner** can invite staff and assign each a precise **role** (Manager / Storekeeper / Cashier / Accountant), a set of **branches**, and an **application access level** — with strict, branch-scoped enforcement so no role can read, mutate, or leak data outside its granted branches.

The `Owner` role is **never** assignable via invitation; it is created structurally at organization signup.

## Codebase facts (not proposals)
- `Membership` model: `(org_id, user_id, role: membership_role, status: membership_status)` — `membership_role = owner | admin | manager | member` (`backend/prisma/schema.prisma`). No branch awareness today.
- `WorkspaceInvitation` already stores `role`, `product_roles` (JSON), `branch_ids` (JSON), `token_hash`, `status`, `invited_by_id`, `expires_at`. Created by `OnboardingService.sendBulkInvitations` (onboarding `team_invites` step). Only accepts `role: admin | member`.
- The invitation **acceptance path** (magic-link → `AuthService.verifyEmail`) does **not** create a `Membership` — it only re-opens a session for the user's existing membership. **This is a confirmed gap.**
- Auth: JWT access token claims `{ sub, email, org_id, role, membership_id, session_id }`; `requireAuth` re-fetches membership every request and revokes the session if `role`/`membership_id` drifts. `AuthService.revokeAllSessions` / `revokeSession` / `listSessions` already exist.
- `StockLevel`, `StockMovement`, `BranchProduct`, `Category`, `Brand` are all already keyed by `branch_id`. (Branch isolation is in-flight — see `.kilo/plans/1791630000000-branch-isolation-and-switching-plan.md`; the `?branch=` URL convention and `BranchGatewayScreen` already exist.)

## Decisions (recommended — bake into plan)
1. **Role vocabulary.** Introduce a new `org_role` enum `{ owner, manager, storekeeper, cashier, accountant }` as a new `Membership.org_role` column. Migrate `Membership.role` in place: `admin → manager`, `member → cashier`. Keep `role` column readable during a deprecation window, then drop. (Do **not** re-alias `admin`/`member`, which conflates semantics.)
2. **Branch scoping at runtime.** Add a proper `MembershipBranchAccess(membership_id, branch_id, is_default, granted_at)` join table instead of relying on the `WorkspaceInvitation.branch_ids` JSON at runtime. A membership-level `scope_all_branches` boolean handles "all branches" (Owner, and "all" invites).
3. **JWT + DB re-resolution.** Embed `branch_scope[]` and `scope_all_branches` in the access token for the UI, but `requireBranchScope` middleware **re-resolves grants from `MembershipBranchAccess` on every request** so revocations are immediate.
4. **Owner exclusion on invite.** `role ≠ owner` enforced in the invite schema + server-side `rejectIf(role === 'owner')`. Owner only ever comes from `createOrganizationWithOwner`.

## Permissions matrix (source of truth for enforcement)
| Capability | Owner | Manager | Storekeeper | Cashier | Accountant |
|---|---|---|---|---|---|
| View all branches | ✅ all | scoped | scoped | scoped | scoped (read) |
| Manage products (catalog CRUD) | ✅ org-wide | own branches | ❌ | ❌ | ❌ |
| Adjust stock | ✅ | own | ✅ w/ reason | ❌ | ❌ |
| Approve transfers | ✅ | own | ✅ (as receiver/approver) | ❌ | ❌ |
| Configure low-stock rules | ✅ | own | ❌ | ❌ | ❌ |
| View stock history/movements | ✅ | own | own | own (sales) | ✅ read |
| Receive stock / GRN | ✅ | own | own | ❌ | ❌ |
| Create transfers | ✅ | own | own | ❌ | ❌ |
| Create sale / return / void | ✅ | own | ❌ | own | ❌ |
| Export reports | ✅ | own | own (history) | own (sales) | ✅ read exports |
| Change another user's role | ✅ | ⚠️ tier-below only | ❌ | ❌ | ❌ |

Tier ordering: `owner > manager > {storekeeper, accountant} > cashier`. A user may only set a subordinate's role to a strictly lower tier (managers can re-role cashier↔accountant but never create a peer manager).

## Ordered tasks

### Phase A — Data model & migration
- [ ] A1. Add `enum org_role { owner manager storekeeper cashier accountant }`.
- [ ] A2. Add `Membership.org_role org_role @default(owner)`; migrate `(admin→manager, member→cashier, owner→owner)`; backfill `scope_all_branches = (role=owner)`.
- [ ] A3. Add `Membership.scope_all_branches Boolean @default(false)`; index `(org_id, scope_all_branches)`.
- [ ] A4. Add `MembershipBranchAccess` join table (see §Decisions).
- [ ] A5. Extend `WorkspaceInvitation` enum to accept the new roles; widen accepted `role` set so `sendBulkInvitations` can store `storekeeper/cashier/accountant` in `branch_ids`/`product_roles` JSON.
- [ ] A6. Add `branch_id` to `AuditLog` (optional) for scoping forensic queries; backfill from `metadata` where present.
- [ ] A7. Prisma migrate dev + integration tests assert constraint validity + backfill correctness.

### Phase B — RBAC primitives (server)
- [ ] B1. Create `backend/src/middleware/rbac.ts` with `requireRole(...roles)`, `requirePermission(capability)`, and the `permission-resolver` mapping §Permissions matrix (single source of truth).
- [ ] B2. Create/extend `backend/src/middleware/branch-guard.ts` `requireBranchScope`: owner bypass; else re-resolve `membership_branches` (or `scope_all_branches`) from DB; reject `branchId`/`X-Active-Branch` not in scope with `403 branch_access_denied` + audit.
- [ ] B3. Add `READ_ONLY_ROLES = [accountant, cashier]` gate to all inventory mutation routes (`POST/PUT/DELETE /products*`, `/stock/adjustments`, `/transfers`, `/sales*` mutations) — reject `403` for these roles regardless of branch.
- [ ] B4. Compose guards on existing routes (do not re-register owner-only admin routes for lower roles).

### Phase C — Invitation workflow (server)
- [ ] C1. New endpoint `POST /organizations/:orgId/invitations` (owner/manager only) with Zod schema capturing `email[]`, `role ∈ {manager,storekeeper,cashier,accountant}` (reject `owner` → 422), `application_access ⊆ active products`, `branch_assignment ∈ {"all"} | string[]`.
- [ ] C2. Route through `OnboardingService.sendBulkInvitations`, widened to accept the new roles; keep existing `skipped|sent|failed` per-recipient reporting. Validate inviter cannot grant branches they don't own.
- [ ] C3. **Acceptance path extension** (`POST /invitations/:token/accept` or extend magic-link verify): on consume, create `Membership(role=org_role, status=active)`, create `MembershipBranchAccess` rows (expand `"all"` to all current branches + set `scope_all_branches=true`; else explicit list + mark `is_default` for the first), consume invitation row. Issue tokens with the new claims.
- [ ] C4. Owner/manager admin actions: `PATCH /memberships/:id` (role/branch/scope), `POST /memberships/:id/block` (suspend + `revokeAllSessions`), `POST /memberships/:id/unblock`, `DELETE /invitations/:id` (revoke pre-accept), `POST /invitations/:id/resend`.

### Phase D — Token & session scope
- [ ] D1. Extend `AccessTokenClaims` with `branch_scope: string[]` and `scope_all_branches: boolean`.
- [ ] D2. Mint new claims on `startTrial`, `setupPasswordAndVerify`, `login`, `refresh`, and the new invite-accept flow.
- [ ] D3. Re-verify scope from DB in `requireAuth` path; on mismatch, revoke via existing `refreshToken.updateMany(... revoke ...)` and throw `FORBIDDEN` (mirrors existing role-drift behavior).

### Phase E — Frontend
- [ ] E1. Extend `useAuthStore` to hold `{ role, branches, scopeAllBranches }` and persist in `orvio_session_state`.
- [ ] E2. `GET /organizations/:orgId/me` (or `/members`) to return the acting user's role + granted branches (filtered: Owner sees all; others see only `membership_branches`).
- [ ] E3. Staff list page: kebab menu gated by tier (`canActOn(member)`); block/revoke/invite actions.
- [ ] E4. Invite drawer: role radio-group (no Owner), app multi-select (installed products), branch checkbox tree (granted + "all" toggle).
- [ ] E5. Branch gateway + dropdown: filter branch list by `scopeAllBranches ? all : membership_branches`.
- [ ] E6. Hide / disable mutation affordances for `accountant`/`cashier` at the UI layer (mirroring server gate) using the `READ_ONLY_ROLES` list.

### Phase F — Audit & observability
- [ ] F1. Emit `membership_suspended`, `membership_reactivated`, `branch_scope_revoked`, `membership_role_changed`, `invitation_revoked`, `invitation_resent`, `branch_access_denied` (on 403) into `AuditLog` with `org_id/user_id/branch_id/ip/user_agent/metadata`.
- [ ] F2. Expose a staff audit trail view (Owner+Manager) listing role changes / block / revoke events.

## Security & failure modes
- **Branch leakage:** blocked at API middleware (`requireBranchScope`) AND data layer (`WHERE branch_id = active` on every inventory query). JSON-array parsing on `branch_ids` is never the authorization source.
- **Self-promotion:** role-change handler rejects `newRoleTier >= actingRoleTier` for non-owners; owner-only creation of manager/promotions audited.
- **Stale session after block/revoke:** `revokeAllSessions(userId)` invalidates refresh-token families immediately; access tokens are short-lived and the JWT-role drift check in `requireAuth` also catches mismatches.
- **URL tampering `?branch=<other>`:** middleware re-resolves grants from DB — the URL alone never grants scope.
- **Storekeeper adjustments w/o reason:** `StockMovement.reason` enforced `NOT NULL` + Storekeeper adjustment route requires `reason ∈ {damage,loss,found,correction,count_reconciliation,other}`.
- **Cashier manual adjustment:** mutation routes gated by `READ_ONLY_ROLES`; POS sale path only ever writes `movement_type: sale|sale_void`.

## Rollout / migration
- New `org_role` column defaults to mapping from existing `role`, so zero-downtime read.
- `requireBranchScope` rolled out per-route (opt-in composition) so existing endpoints are not broken mid-migration.
- Backfill existing `MembershipBranchAccess` for current `Membership`s: Owners → `scope_all_branches=true` (no rows needed); `admin` (becomes manager) and `member` (becomes cashier) → grant their org's primary branch (single-branch orgs) until an Owner re-scopes them.
- Feature flag `EMPLOYEE_MANAGEMENT` gates the new invite endpoint + admin UI so it can ship disabled, then flip on per-org.

## Validation plan
- [ ] V1. Unit: `requireBranchScope` rejects out-of-scope `branchId`; owner bypass.
- [ ] V2. Unit: `requireRole` + tier check blocks self/peer promotion.
- [ ] V3. Integration: Owner invites cashier to B1 → accept → `Membership.role=cashier`, `MembershipBranchAccess={B1}`, JWT claims correct.
- [ ] V4. Integration: Cashier `GET /stock/movements?branchId=B2` → `403` + `branch_access_denied` audit row.
- [ ] V5. Integration: Owner blocks user → subsequent request → `403` ("permissions changed").
- [ ] V6. E2E: Staff list shows correct kebab actions per tier; branch gateway filters to granted branches only.
- [ ] V7. Migration: seeded orgs with `admin`/`member` map to `manager`/`cashier` + primary-branch access preserved.

## Open questions (resolved by assumption — flag for review)
1. **Tier equality:** `storekeeper` and `accountant` treated as the same tier for promotion purposes (both non-manager, non-cashier). *Decision: yes — a manager may re-role between them; an Owner can promote accountant↔manager only.*
2. **Manager invite limit:** A Manager can invite staff but only into their own granted branches and only roles below manager tier. *Decision: confirm this is acceptable (prevents Manager from creating another Manager).*
3. **Cashier "own branch":** Cashiers are typically single-branch; the model allows multi-branch cashiers but the UI will default to single-branch selection. *Decision: supported, not enforced.*
4. **Re-inviting an existing user:** If the email already has an *active* membership, the invite is rejected with `409 ALREADY_MEMBER`. *Decision: keep existing `sendBulkInvitations` skip behavior.*

## Out of scope (future work)
- Per-role feature flags beyond the five (e.g. "view cost prices", "discount > threshold") — belongs in a `membership_feature_flags` table.
- Multi-organization memberships / cross-org delegation.
- Configurable multi-approve transfer policies.
