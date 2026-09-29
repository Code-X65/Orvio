# Orvio frontend

Standalone React 19 + TypeScript application for Orvio. This is the UI foundation only: product screens and authentication flows are intentionally deferred until their backend contracts are implemented.

## Setup

```bash
pnpm install
Copy-Item .env.example .env
pnpm dev
```

`VITE_API_BASE_URL` is the only browser-visible backend URL. It defaults to `http://localhost:3000/api/v1`; backend CORS must allow the Vite development origin, `http://localhost:4000`.

## Commands

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Conventions

- Reuse primitives from `src/components/ui` and compose styles with `cn()`.
- Use the shared `apiRequest()` function for all backend calls; do not add competing clients.
- Routes and screens belong under `src/app` or a future feature module. Keep API data in TanStack Query and only shared UI/auth state in Zustand.
- Future product APIs mount under `/api/v1`; infrastructure health endpoints are not frontend feature endpoints.
