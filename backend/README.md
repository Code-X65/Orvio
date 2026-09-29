# Orvio backend

The backend is a standalone Fastify + TypeScript service focused on authentication and personal onboarding. Product and multi-tenant workspace APIs are deferred until their scope is approved.

## Prerequisites

- Node.js 20 or newer
- pnpm 10 or newer
- Docker Desktop for local PostgreSQL and container-backed integration tests

## Local setup

```bash
pnpm install
Copy-Item .env.example .env
docker compose up -d postgres
pnpm prisma:generate
pnpm prisma:migrate:deploy
pnpm dev
```

`GET /health` confirms the process is running. `GET /ready` also checks PostgreSQL. The development frontend runs at `http://localhost:4000` and is the default allowed CORS origin.

## API documentation

With the server running, open `http://localhost:3000/docs` for Swagger UI. The generated OpenAPI JSON is available at `http://localhost:3000/docs/json`. Add a complete Fastify JSON Schema to every new route so it is validated, serialized, and included in the documentation.

## Commands

```bash
pnpm dev
pnpm lint
pnpm typecheck
pnpm test
RUN_TESTCONTAINERS=true pnpm test
pnpm build
pnpm prisma:seed
```

`RUN_TESTCONTAINERS=true` enables the real PostgreSQL readiness integration test. Standard tests use injected database doubles for fast feedback.

`pnpm prisma:seed` is idempotent and is blocked when `NODE_ENV=production`. It creates `owner@orvio.test` with password `orvio-test-password`, current legal documents, and completed personal onboarding. These credentials are for development/test databases only.

## Future module convention

Add product code under `src/modules/<feature>/`. Routes own HTTP validation, services own business rules and transactions, and repositories own tenant-scoped Prisma data access. Future product endpoints mount under `/api/v1`; `/health` and `/ready` remain unversioned infrastructure routes.
