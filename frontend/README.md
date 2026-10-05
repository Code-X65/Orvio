# Orvio Frontend Client

Web frontend client and marketing portal for Orvio Hub built with React 19, TypeScript, Vite, Tailwind CSS, TanStack Query, and Zustand.

---

## 1. Quick Start & Setup

### Prerequisites
- **Node.js**: `>= 20.0.0`
- **pnpm**: `>= 9.0.0`

### Installation
```powershell
# Install dependencies
pnpm install

# Copy environment variables
Copy-Item .env.example .env

# Start Vite development server
pnpm dev
```

The application will boot at `http://localhost:4000` (or `http://localhost:5173`).

---

## 2. Environment Variables Reference

| Variable | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `VITE_API_BASE_URL` | `string` | `http://localhost:3000` | Base URL for the Orvio API backend service. |
| `VITE_APP_BASE_DOMAIN` | `string` | `orvio.com` | Root platform domain used for generating workspace links. |

---

## 3. Architecture & Feature Modules

### Signup Wizard (`src/features/signup/`)
The organization onboarding flow is implemented as a 3-step state machine with independent step validation:

- **Step 1: Account Step (`AccountStep.tsx`)**:
  - Full Name, Work Email, Phone (optional), and Password.
  - Live 4-point password criteria meters (length ≥8, uppercase, lowercase, digit).
  - Validated by `AccountStepSchema`.

- **Step 2: Business & Workspace Step (`OrganizationStep.tsx`)**:
  - Plan selection pills (`inventory`, `gym`, `bundle`), pre-hydrated from URL query params (e.g. `?plan=inventory`).
  - Business Name with automatic subdomain derivation mirror.
  - Subdomain field with `.orvio.com` suffix preview and 400ms debounced live availability badge (`useSubdomainAvailability.ts`).
  - Clickable candidate suggestion chips for collision resolution.
  - Timezone and Currency `<Select>` selectors.
  - Validated by `OrganizationStepSchema`.

- **Step 3: Confirmation Step (`ConfirmationStep.tsx`)**:
  - Check-your-email prompt with workspace subdomain copy button (`CopyUrlButton.tsx`).
  - Resend verification button with live 60-second cooldown timer.

### State & API Layer
- **`src/stores/auth-store.ts`**: Zustand store managing in-memory access tokens, tenant profile, and authentication state (`anonymous`, `authenticating`, `authenticated`, `pending-verification`).
- **`src/lib/api/client.ts`**: Type-safe `fetch` wrapper supporting automatic envelope unwrapping, single-flight 401 refresh retries, and structured `ApiError` mapping.

---

## 4. Development & Testing Commands

```powershell
# Run Vitest unit and component test suite
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run Playwright End-to-End browser tests
pnpm e2e

# Run Playwright Smoke suite only
pnpm e2e:smoke

# Execute ESLint
pnpm lint

# Execute TypeScript type checker
pnpm typecheck

# Build production bundle
pnpm build

# Preview production build locally
pnpm preview
```

---

## 5. Testing & Mocking Strategy

- **Component Tests**: Tested using React Testing Library and MSW v2 (Mock Service Worker) handlers located in `src/test/mocks/handlers.ts`.
- **E2E Tests**: Playwright browser suite in `e2e/signup.spec.ts` executing end-to-end user journeys against a Vite preview server with mocked API routes for determinism.
