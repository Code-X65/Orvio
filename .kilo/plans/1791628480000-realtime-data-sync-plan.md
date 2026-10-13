# Real-Time Data Synchronization for Orvio Inventory

## Goal
Implement real-time (sub-second) data synchronization so inventory changes (products, categories, brands, branches) are instantly reflected in all connected clients' UIs without manual refresh or polling. Use **WebSockets** via `@fastify/websocket` layered with the existing **`@tanstack/react-query`** cache for automatic data invalidation. **No Redis** — in-process event broadcasting only (single-instance architecture).

## Current State
| Layer | Status | Detail |
|---|---|---|
| Frontend `@tanstack/react-query` | Installed + configured | `QueryClientProvider` in `providers.tsx` (`staleTime: 60s`), but barely used (only `useSubdomainAvailability`) |
| Frontend data fetching | Manual `fetch` + `useState` | `ProductsPage`, `CategoriesPage` use manual `useCallback` fetch + state |
| Frontend cross-tab sync | BroadcastChannel | `orvio_auth_mesh` channel in `auth-store.ts` — proven pattern |
| Backend real-time | NONE | No WebSockets, no SSE, no Redis, no pub/sub |
| Backend auth | JWT Bearer token | `requireAuth` in `middleware/auth.ts`, `verifyAccessToken` in `lib/tokens.ts` |
| Backend structure | Fastify v5 + Prisma + PostgreSQL | `server.ts` is single-process, no clustering |
| Cache invalidation | In-memory cache | `InMemoryCache`; `invalidateCache()` called in ProductService, BranchService |

## Architecture Decisions

### D1: WebSocket transport (not SSE)
Choose `@fastify/websocket` + `ws` library. Bidirectional enables optimistic updates + server confirmation; native Fastify v5 support; single connection multiplexes all entity channels. Auth: client connects with `?token=ACCESS_JWT`, server reuses `verifyAccessToken()`.

### D2: In-process event bus (no Redis)
Use `Map<string, Set<WebSocket>>` keyed by `org:{orgId}`. Codebase is single-instance (`server.ts` is plain Node.js). Create `EventBroadcaster` interface so swapping to Redis pub/sub later is a 1-file change.

### D3: Event-driven from existing cache invalidation hooks
Every `this.invalidateCache(orgId)` call in services is the trigger point. Add `eventBus.broadcastToOrg(orgId, message)` alongside each invalidation.

### D4: React Query as data layer (progressive migration)
Already installed and configured at app root. Create `useProducts`, `useCategories` hooks. Migrate `ProductsPage` then `CategoriesPage`. WebSocket events trigger `queryClient.invalidateQueries()` — no polling.

### D5: Cross-tab deduplication via BroadcastChannel
If multiple tabs open for same org, WS message in Tab A can be forwarded via BroadcastChannel to Tab B. Reuse existing `BroadcastChannel('orvio_auth_mesh')` pattern or create new `orvio_inventory_events` channel.

### D6: Graceful degradation
If WS fails, React Query falls back to existing stale-time behavior. `refetchOnWindowFocus: false` means polling doesn't happen — WS is the primary sync mechanism.

## Event Message Protocol
```typescript
interface RealtimeMessage {
  type: 'product:created' | 'product:updated' | 'product:deleted' |
        'product_images:updated' | 'category:updated' |
        'brand:created' | 'brand:updated' | 'brand:deleted' |
        'branch:updated' | 'catalog:import_complete' |
        'stock_level:updated';
  orgId: string;
  payload: Record<string, unknown>;
  timestamp: string;
}
```

**Event → Query invalidation mapping:**

| Event Type | React Query invalidation |
|---|---|
| `product:created` | `['inventory', 'products', orgId]` |
| `product:updated` | `['inventory', 'products', orgId]` + `['inventory', 'product', productId]` |
| `product:deleted` | `['inventory', 'products', orgId]` |
| `product_images:updated` | `['inventory', 'product', productId]` |
| `category:updated` | `['inventory', 'categories', orgId]` |
| `brand:created/updated/deleted` | `['inventory', 'brands', orgId]` + `['inventory', 'products', orgId]` |
| `branch:updated` | `['inventory', 'branches', orgId]` |
| `catalog:import_complete` | `['inventory', 'products', orgId, { branchId }]` |
| `stock_level:updated` | `['inventory', 'products', orgId, { branchId }]` |

## Backend Implementation Tasks

### Phase 1: WebSocket Infrastructure
- [x] **T1.1**: Add `@fastify/websocket` and `ws` to `backend/package.json` dependencies
- [x] **T1.2**: Create `backend/src/infrastructure/websocket/event-bus.ts` — `EventBroadcaster` interface + in-process `Map<string, Set<WebSocket>>` singleton `eventBus` with `broadcastToOrg()`, `registerConnection()`, `unregisterConnection()`, `closeAll()`
- [x] **T1.3**: Create `backend/src/infrastructure/websocket/websocket-plugin.ts` — Fastify WS plugin at `/events`; auth via `verifyAccessToken(request.query.token)`; join `org:{org_id}` room; heartbeat ping/pong every 30s; handle `token:refresh` messages; cleanup on close
- [x] **T1.4**: Register plugin in `backend/src/app.ts` — `app.register(websocketPlugin, { prefix: '/events' })`
- [x] **T1.5**: Update CORS `allowedHeaders` in `app.ts` to include `Upgrade` and `Connection`

### Phase 2: Event Emission Integration
Add `eventBus.broadcastToOrg(orgId, {...})` after each `this.invalidateCache(orgId)` call:

- [x] **T2.1** `products-service.ts` — createProduct, updateProduct, deleteProduct/restoreProduct, uploadProductImages, reorderProductImages, deleteProductImage, updateProductImage, updateVariant/createVariant/deleteVariant
- [x] **T2.2** `categories-service.ts` — createCategory, updateCategory, deleteCategory, reorderCategories, image upload/delete
- [x] **T2.3** `branches-service.ts` — createBranch, updateBranch, deleteBranch, restoreBranch
- [x] **T2.4** `brands-service.ts` — createBrand, updateBrand, deleteBrand/restoreBrand
- [x] **T2.5** `catalog-service.ts` — importCatalog → `catalog:import_complete`, removeProduct → `catalog:updated`

### Phase 3: WebSocket Tests
- [x] **T3.1**: `backend/tests/integration/websocket-auth.test.ts` — WS connection with valid/invalid/expired tokens
- [x] **T3.2**: `backend/tests/integration/websocket-broadcast.test.ts` — org-scoped broadcast reach verification

## Frontend Implementation Tasks

### Phase 4: WebSocket Hook
- [x] **F4.1**: Create `frontend/src/hooks/useOrgWebSocket.ts` — opens WS to `ws://host/api/v1/events?token=JWT&org=ORG_ID`; handles onopen/onmessage/onclose/onerror; maps message `type` → `queryClient.invalidateQueries({ queryKey: [...] })`; exponential backoff reconnect (max 30s); heartbeat ping/pong; returns `'connecting' | 'connected' | 'disconnected' | 'error'`
- [x] **F4.2**: Add `getWsBaseUrl()` helper to `frontend/src/lib/api/client.ts` — derive WS URL from existing `getBaseUrl()`: `baseUrl.replace(/^http/, 'ws')`

### Phase 5: React Query Hooks
- [x] **F5.1**: Create `frontend/src/features/inventory/hooks/useProducts.ts` — `useQuery` wrapping `productApi.listProducts`; query key `['inventory', 'products', orgId, branchId, filters]`; `staleTime: 5min`
- [x] **F5.2**: Create `frontend/src/features/inventory/hooks/useCategories.ts` — `useQuery` wrapping `categoryApi.getCategories`; query key `['inventory', 'categories', orgId]`
- [x] **F5.3**: Create `frontend/src/features/inventory/hooks/useBrands.ts` — `useQuery` wrapping `brandApi.getBrands`; query key `['inventory', 'brands', filters]`

### Phase 6: Component Migration
- [x] **F6.1**: Migrate `ProductsPage.tsx` — replace manual fetch with `useProducts`; keep existing filter state (selectedCategoryId, statusFilter) as query deps
- [x] **F6.2**: Migrate `CategoriesPage.tsx` — replace manual fetch with `useCategories`
- [x] **F6.3**: Migrate `BrandsPage.tsx` — replace manual fetch with `useBrands`
- [x] **F6.4**: Add `useOrgWebSocket(orgId, accessToken)` call in `InventoryWorkspacePage.tsx` with live sync status badge so all child views (Products, Categories, Brands) get real-time updates from one connection

### Phase 7: Cross-Tab Sync
- [x] **F7.1**: Create `frontend/src/hooks/useCrossTabSync.ts` — `BroadcastChannel('orvio_inventory_events')`; when WS message received, also broadcast via channel; other tabs receive channel message and trigger same React Query invalidation
- [x] **F7.2**: Integrate `useCrossTabSync` into `useOrgWebSocket` hook

### Phase 8: Frontend Tests
- [x] **F8.1**: `frontend/src/hooks/useOrgWebSocket.test.ts` — mock WebSocket; verify query invalidation mapping, token refresh, and reconnect
- [x] **F8.2**: `frontend/src/features/inventory/hooks/useProducts.test.ts` — verify query key and data transformation

## WebSocket Connection Flow
```
1. Browser loads app → AuthStore hydrates
2. InventoryWorkspacePage mounts → useOrgWebSocket(orgId, accessToken) called
3. Hook opens WebSocket: ws://host/api/v1/events?token=JWT&org=ORG_ID
4. Server: verifyAccessToken(token) → extract org_id → join Set<WebSocket> for org:{org_id}
5. Server sends { type: 'welcome' }
6. Heartbeat: client sends 'ping' every 25s; server responds 'pong'
7. On REST mutation:
   a. Service creates/updates product
   b. invalidateCache(orgId) → cache cleared (existing)
   c. eventBus.broadcastToOrg(orgId, { type: 'product:created', payload: { id } })
   d. All WS in org room receive message
   e. useOrgWebSocket → queryClient.invalidateQueries(['inventory', 'products', orgId])
   f. React Query refetches → ProductsPage re-renders instantly
8. If connection drops → exponential backoff reconnect
9. Token expires → client sends { type: 'token:refresh', payload: { token } } → server re-validates
```

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| WS connection fails (proxy/mobile) | Graceful fallback — React Query with staleTime; reconnect with backoff |
| Too many concurrent WS connections | Org-scoped rooms; 1 WS per org per browser via BroadcastChannel dedup |
| Broadcast flooding (rapid mutations) | Debounce same-type events within 500ms window in EventBroadcaster |
| Token expires during WS session | Client sends `token:refresh` message; if invalid, server sends `token:expired` → client closes + triggers auth flow |
| Missing `Upgrade` header in nginx | Document: `proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection "upgrade";` |
| Single-instance only (no Redis) | EventBroadcaster interface makes Redis swap a 1-file change; document scaling requirement |
| Memory leak from stale WS connections | `unregisterConnection` on close/error hooks; `closeAll()` on shutdown |
| React Query migration breaks existing behavior | Progressive: migrate ProductsPage first; keep ComponentsPage working via fallback |

## Validation Plan
1. `cd backend && npm test` — existing tests pass + new WS auth/broadcast tests pass
2. `cd frontend && npm run test` — existing tests + new hook tests pass
3. Manual: Two tabs same org → create product in tab A → both tabs show new product instantly
4. Manual: User A creates product → User B (same org) sees update instantly
5. Manual: WS disconnect → verify reconnect + cache invalidation catch-up
6. Manual: Token expiry during WS session → verify clean reconnection
7. Manual: Disable JS WS → verify products still load via React Query fetch (fallback)
