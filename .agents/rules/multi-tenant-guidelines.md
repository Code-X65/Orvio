# Multi-Tenant & Database Migration Guidelines

## 1. PostgreSQL Enum DDL Transaction Isolation
PostgreSQL does not allow referencing a freshly added enum value within the same migration transaction block (`invalid input value for enum ...`).
- **Rule**: Whenever expanding Postgres enum types in Prisma migrations, isolate the `ALTER TYPE ... ADD VALUE` statement or wrap additions in safe idempotent blocks:
  ```sql
  DO $$ BEGIN
    ALTER TYPE "membership_role" ADD VALUE 'member';
  EXCEPTION
    WHEN duplicate_object THEN null;
  END $$;
  ```

## 2. Multi-Tenant Query Cache Purging on Organization Switch
- **Rule**: When switching active organizations in a multi-tenant SPA, always purge tenant-scoped TanStack Query cache keys (`['branches']`, `['organization']`, `['apps-launcher']`, `['billing']`) while keeping user credentials and global session intact. Use the centralized `useTenantSwitch` hook to avoid cross-tenant cache leaks.

## 3. Conditional Onboarding & Guard Queries
- **Rule**: Never run unconditional background status queries (e.g. SurveyGate or Session probes) on unauthenticated public routes. Always gate with:
  ```tsx
  enabled: Boolean(user?.id && !onboardingCompleted)
  ```
